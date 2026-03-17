import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { baseSepolia, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'EVVM Ichiban Deployer',
  projectId: 'b3d3e8a1c7f04e9b8d2a5c6e7f8a9b0c', // Replace with your Reown project ID from https://cloud.reown.com
  chains: [baseSepolia, sepolia],
  ssr: false,
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
  },
});

export const SUPPORTED_CHAINS = {
  BASE_SEPOLIA: baseSepolia,
  SEPOLIA: sepolia,
} as const;

export const getExplorerUrl = (chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string => {
  const explorers: Record<number, string> = {
    84532: `https://sepolia.basescan.org/${type}/${hash}`,
    11155111: `https://sepolia.etherscan.io/${type}/${hash}`,
  };
  return explorers[chainId] || '#';
};

export const getChainName = (chainId: number): string => {
  const names: Record<number, string> = {
    84532: 'Base Sepolia',
    11155111: 'Sepolia',
  };
  return names[chainId] || 'Unknown';
};
