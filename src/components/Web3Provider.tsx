import type { ReactNode } from 'react';
import { AppWalletProvider } from '@/hooks/useAppWallet';

export function Web3Provider({ children }: { children: ReactNode }) {
  return <AppWalletProvider>{children}</AppWalletProvider>;
}
