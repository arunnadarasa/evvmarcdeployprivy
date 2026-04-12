import { LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppWallet } from '@/hooks/useAppWallet';

type PrivyAuthButtonProps = {
  className?: string;
};

function shorten(address?: string) {
  if (!address) return 'Wallet';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function PrivyAuthButton({ className }: PrivyAuthButtonProps) {
  const { isConnected, ready, login, logout, eoaAddress, smartAccountAddress } = useAppWallet();

  if (!ready) {
    return (
      <Button disabled className={className}>
        Loading wallet...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button onClick={() => login()} className={className}>
        <ShieldCheck className="h-4 w-4" />
        Continue with Privy
      </Button>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium leading-none text-foreground">
            Privy wallet {shorten(eoaAddress)}
          </p>
          <p className="mt-1 truncate text-[10px] leading-none text-muted-foreground">
            Fund this address for Arc deploys{smartAccountAddress ? ` • ZeroDev ${shorten(smartAccountAddress)}` : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void logout()}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
