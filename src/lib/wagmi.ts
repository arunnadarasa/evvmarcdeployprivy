import { createPublicClient, defineChain, http, type Chain, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

export { sepolia };

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
    public: {
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = {
  ARC_TESTNET: arcTestnet,
  SEPOLIA: sepolia,
} as const;

export const ZERO_DEV_PROJECT_ID =
  import.meta.env.VITE_ZERODEV_PROJECT_ID || '92691254-2986-488c-9c5d-b6028a3deb3a';

const publicClients = new Map<number, PublicClient>();

export function getSupportedChain(chainId: number): Chain {
  switch (chainId) {
    case arcTestnet.id:
      return arcTestnet;
    case sepolia.id:
      return sepolia;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

export function getPublicClient(chainId: number): PublicClient {
  const existing = publicClients.get(chainId);
  if (existing) return existing;

  const chain = getSupportedChain(chainId);
  const client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  publicClients.set(chainId, client);
  return client;
}

export function getZeroDevBundlerRpcUrl(chainId: number): string {
  return `https://rpc.zerodev.app/api/v3/${ZERO_DEV_PROJECT_ID}/chain/${chainId}`;
}

export function getZeroDevPaymasterRpcUrl(chainId: number): string {
  return `https://rpc.zerodev.app/api/v3/${ZERO_DEV_PROJECT_ID}/chain/${chainId}`;
}

export const getExplorerUrl = (chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string => {
  if (chainId === arcTestnet.id) {
    return `https://testnet.arcscan.app/${type}/${hash}`;
  }

  const explorers: Record<number, string> = {
    [sepolia.id]: `https://sepolia.etherscan.io/${type}/${hash}`,
  };

  return explorers[chainId] || '#';
};

export const getChainName = (chainId: number): string => {
  const names: Record<number, string> = {
    [arcTestnet.id]: 'Arc Testnet',
    [sepolia.id]: 'Sepolia',
  };

  return names[chainId] || 'Unknown';
};
