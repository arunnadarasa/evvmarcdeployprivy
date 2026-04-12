import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

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

export const config = getDefaultConfig({
  appName: 'EVVM Arc Deployer',
  projectId: 'b3d3e8a1c7f04e9b8d2a5c6e7f8a9b0c', // Replace with your Reown project ID from https://cloud.reown.com
  chains: [arcTestnet, sepolia],
  ssr: false,
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [sepolia.id]: http(),
  },
});

export const SUPPORTED_CHAINS = {
  ARC_TESTNET: arcTestnet,
  SEPOLIA: sepolia,
} as const;

export const getExplorerUrl = (chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string => {
  if (chainId === arcTestnet.id) {
    return `https://testnet.arcscan.app/${type}/${hash}`;
  }

  const explorers: Record<number, string> = {
    11155111: `https://sepolia.etherscan.io/${type}/${hash}`,
  };
  return explorers[chainId] || '#';
};

export const getChainName = (chainId: number): string => {
  const names: Record<number, string> = {
    5042002: 'Arc Testnet',
    11155111: 'Sepolia',
  };
  return names[chainId] || 'Unknown';
};
