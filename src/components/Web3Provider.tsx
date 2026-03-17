import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';

const queryClient = new QueryClient();

const evvmTheme = darkTheme({
  accentColor: 'hsl(221, 100%, 50%)',
  accentColorForeground: 'white',
  borderRadius: 'small',
  fontStack: 'system',
});

// Override specific theme values
evvmTheme.colors.connectButtonBackground = 'hsl(240, 20%, 8%)';
evvmTheme.colors.modalBackground = 'hsl(240, 20%, 6%)';
evvmTheme.colors.modalBorder = 'hsl(240, 22%, 15%)';

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={evvmTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
