import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';

const queryClient = new QueryClient();

const evvmTheme = darkTheme({
  accentColor: 'hsl(188, 87%, 56%)',
  accentColorForeground: 'white',
  borderRadius: 'small',
  fontStack: 'rounded',
});

// Override specific theme values
evvmTheme.colors.connectButtonBackground = 'hsl(205, 33%, 11%)';
evvmTheme.colors.modalBackground = 'hsl(205, 39%, 7%)';
evvmTheme.colors.modalBorder = 'hsl(201, 30%, 20%)';

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
