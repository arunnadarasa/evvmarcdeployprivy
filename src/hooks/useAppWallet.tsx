import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getEmbeddedConnectedWallet,
  PrivyProvider,
  toViemAccount,
  usePrivy,
  useWallets,
  type ConnectedWallet,
} from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Chain as PrivyChain } from '@privy-io/js-sdk-core';
import { createWalletClient, custom, http, type Address, type Chain, type WalletClient } from 'viem';
import { toAccount } from 'viem/accounts';
import { signAuthorization, signMessage, signTypedData } from 'viem/actions';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  type KernelAccountClient,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  arcTestnet,
  getPublicClient,
  getSupportedChain,
  getZeroDevBundlerRpcUrl,
  getZeroDevPaymasterRpcUrl,
  sepolia,
} from '@/lib/wagmi';

const PRIVY_APP_ID =
  import.meta.env.VITE_PRIVY_APP_ID || 'cmmv0z6dv06bs0djs07c7vrl3';

const PRIVY_SUPPORTED_CHAINS = [arcTestnet, sepolia] as unknown as PrivyChain[];

const queryClient = new QueryClient();

function stripUnsupportedUserOperationKeys<T extends { chain?: unknown }>(parameters: T): Omit<T, 'chain'> {
  const { chain: _chain, ...rest } = parameters;
  return rest;
}

async function providerToSigner({
  provider,
  address,
}: {
  provider: Awaited<ReturnType<ConnectedWallet['getEthereumProvider']>>;
  address: Address;
}) {
  const walletClient = createWalletClient({
    account: address,
    transport: custom(provider),
  });

  return toAccount({
    address,
    async signMessage({ message }) {
      return signMessage(walletClient, { message });
    },
    async signTypedData(typedData) {
      const { primaryType, domain, message, types } = typedData;
      return signTypedData(walletClient, {
        primaryType,
        domain,
        message,
        types,
      });
    },
    async signTransaction() {
      throw new Error("Smart account signer doesn't need to sign transactions");
    },
    async signAuthorization(authorization) {
      return signAuthorization(walletClient, authorization);
    },
  });
}

type AppWalletContextValue = {
  ready: boolean;
  authenticated: boolean;
  isConnected: boolean;
  login: () => void;
  logout: () => Promise<void>;
  embeddedWallet: ConnectedWallet | null;
  eoaAddress?: Address;
  smartAccountAddress?: Address;
  chain?: Chain;
  getEoaWalletClient: (chainId?: number) => Promise<WalletClient>;
  getSmartAccountClient: (chainId?: number) => Promise<KernelAccountClient>;
  switchChain: (chainId: number) => Promise<void>;
};

const AppWalletContext = createContext<AppWalletContextValue | null>(null);

function AppWalletContextProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const embeddedWallet = useMemo(() => getEmbeddedConnectedWallet(wallets), [wallets]);
  const [currentChainId, setCurrentChainId] = useState<number>(arcTestnet.id);
  const eoaClientCache = useRef(new Map<number, Promise<WalletClient>>());
  const smartClientCache = useRef(new Map<number, Promise<KernelAccountClient>>());
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function syncChain() {
      if (!embeddedWallet) {
        if (!cancelled) {
          setCurrentChainId(arcTestnet.id);
          setSmartAccountAddress(undefined);
        }
        return;
      }

      try {
        const provider = await embeddedWallet.getEthereumProvider();
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        if (!cancelled) {
          setCurrentChainId(Number.parseInt(String(chainIdHex), 16));
        }
      } catch {
        if (!cancelled) {
          setCurrentChainId(arcTestnet.id);
        }
      }
    }

    void syncChain();

    return () => {
      cancelled = true;
    };
  }, [embeddedWallet]);

  const ensureWallet = useCallback(() => {
    if (!embeddedWallet) {
      throw new Error('Sign in with Privy to continue');
    }
    return embeddedWallet;
  }, [embeddedWallet]);

  const getEoaWalletClient = useCallback(
    async (chainId: number = currentChainId) => {
      const cached = eoaClientCache.current.get(chainId);
      if (cached) return cached;

      const promise = (async () => {
        const wallet = ensureWallet();
        await wallet.switchChain(chainId);
        const provider = await wallet.getEthereumProvider();
        const account = await toViemAccount({ wallet });

        return createWalletClient({
          account,
          chain: getSupportedChain(chainId),
          transport: custom(provider),
        });
      })();

      eoaClientCache.current.set(chainId, promise);
      return promise;
    },
    [currentChainId, ensureWallet]
  );

  const getSmartAccountClient = useCallback(
    async (chainId: number = currentChainId) => {
      const cached = smartClientCache.current.get(chainId);
      if (cached) return cached;

      const promise = (async () => {
        const wallet = ensureWallet();
        await wallet.switchChain(chainId);
        const provider = await wallet.getEthereumProvider();
        const signer = await providerToSigner({
          provider,
          address: wallet.address as Address,
        });

        const publicClient = getPublicClient(chainId);
        const entryPoint = getEntryPoint('0.7');
        const validator = await signerToEcdsaValidator(publicClient, {
          signer,
          entryPoint,
          kernelVersion: KERNEL_V3_1,
        });

        const account = await createKernelAccount(publicClient, {
          plugins: { sudo: validator },
          entryPoint,
          kernelVersion: KERNEL_V3_1,
          // Arc is the non-standard chain in this app, and disabling the meta-factory
          // path mirrors the safer pattern we used in the working reference integration.
          useMetaFactory: chainId !== arcTestnet.id,
        });

        const paymasterClient = createZeroDevPaymasterClient({
          chain: getSupportedChain(chainId),
          transport: http(getZeroDevPaymasterRpcUrl(chainId)),
        });

        const client = createKernelAccountClient({
          account,
          chain: getSupportedChain(chainId),
          client: publicClient,
          bundlerTransport: http(getZeroDevBundlerRpcUrl(chainId)),
          paymaster: {
            getPaymasterData: (parameters) =>
              paymasterClient.sponsorUserOperation({
                userOperation: stripUnsupportedUserOperationKeys(parameters),
              }),
          },
        });

        if (chainId === currentChainId) {
          setSmartAccountAddress(account.address);
        }

        return client;
      })();

      smartClientCache.current.set(chainId, promise);
      return promise;
    },
    [currentChainId, ensureWallet]
  );

  const switchChain = useCallback(
    async (chainId: number) => {
      const wallet = ensureWallet();
      await wallet.switchChain(chainId);
      eoaClientCache.current.delete(chainId);
      smartClientCache.current.delete(chainId);
      setCurrentChainId(chainId);

      try {
        const smartClient = await getSmartAccountClient(chainId);
        setSmartAccountAddress(smartClient.account.address as Address);
      } catch {
        setSmartAccountAddress(undefined);
      }
    },
    [ensureWallet, getSmartAccountClient]
  );

  useEffect(() => {
    if (!embeddedWallet || !authenticated) {
      eoaClientCache.current.clear();
      smartClientCache.current.clear();
      setSmartAccountAddress(undefined);
      return;
    }

    void getSmartAccountClient(currentChainId)
      .then((client) => setSmartAccountAddress(client.account.address as Address))
      .catch(() => setSmartAccountAddress(undefined));
  }, [authenticated, currentChainId, embeddedWallet, getSmartAccountClient]);

  const value = useMemo<AppWalletContextValue>(
    () => ({
      ready: ready && walletsReady,
      authenticated,
      isConnected: authenticated && !!embeddedWallet,
      login,
      logout,
      embeddedWallet,
      eoaAddress: embeddedWallet?.address as Address | undefined,
      smartAccountAddress,
      chain: getSupportedChain(currentChainId),
      getEoaWalletClient,
      getSmartAccountClient,
      switchChain,
    }),
    [
      authenticated,
      currentChainId,
      embeddedWallet,
      getEoaWalletClient,
      getSmartAccountClient,
      login,
      logout,
      ready,
      smartAccountAddress,
      switchChain,
      walletsReady,
    ]
  );

  return <AppWalletContext.Provider value={value}>{children}</AppWalletContext.Provider>;
}

export function AppWalletProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#23d4e8',
          landingHeader: 'Deploy EVVM with Privy',
          loginMessage: 'Use social login to create your embedded wallet, then send sponsored transactions through ZeroDev.',
          showWalletLoginFirst: false,
        },
        loginMethods: ['google', 'twitter', 'discord', 'github', 'apple'],
        defaultChain: arcTestnet as unknown as PrivyChain,
        supportedChains: PRIVY_SUPPORTED_CHAINS,
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          showWalletUIs: false,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AppWalletContextProvider>{children}</AppWalletContextProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export function useAppWallet() {
  const context = useContext(AppWalletContext);
  if (!context) {
    throw new Error('useAppWallet must be used within AppWalletProvider');
  }
  return context;
}
