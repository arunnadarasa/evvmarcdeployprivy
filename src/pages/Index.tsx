import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hexagon, Rocket, PenTool, LayoutDashboard, ArrowRight, ShieldCheck, Waves, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Rocket,
    title: 'Deploy EVVM',
    description: 'Deploy the EVVM stack on Arc Testnet with Arcscan-linked manifests and Sepolia registry handoff',
    to: '/deploy',
  },
  {
    icon: PenTool,
    title: 'Sign Transactions',
    description: 'Generate EIP-191 signatures for pay, dispersePay, and staking operations',
    to: '/signatures',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Track and manage all your EVVM deployments with full manifest export',
    to: '/dashboard',
  },
];

export default function Index() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  return (
    <main className="container max-w-screen-xl px-4 py-12 md:py-20">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/70 px-6 py-12 text-center shadow-2xl shadow-primary/5 md:px-12 md:py-16 mb-16"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(188_87%_56%_/_0.16),_transparent_40%),linear-gradient(135deg,_hsl(205_90%_55%_/_0.08),_transparent_55%)]" />
        <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-success/10 blur-3xl" />

        <div className="relative inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-6">
          <Hexagon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">EVVM Arc Deploy Console</span>
        </div>

        <h1 className="relative text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Launch Your Virtual
          <br />
          <span className="text-gradient-primary">Blockchain on Arc Testnet</span>
        </h1>

        <p className="relative text-muted-foreground max-w-2xl mx-auto mb-8 text-sm md:text-base leading-relaxed">
          Stablecoin-gas deployment for EVVM on Arc Testnet. Configure your stack, push the full bytecode-backed
          contract suite on-chain, and complete registry registration on Ethereum Sepolia without leaving the browser.
        </p>

        <div className="relative grid gap-3 text-left md:grid-cols-3 mb-8">
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <Waves className="mb-3 h-4 w-4 text-primary" />
            <p className="text-xs font-semibold">Arc-native gas flow</p>
            <p className="mt-1 text-xs text-muted-foreground">Deploy with USDC-denominated gas on Arc Testnet chain `5042002`.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <ShieldCheck className="mb-3 h-4 w-4 text-primary" />
            <p className="text-xs font-semibold">Bytecode-backed deploys</p>
            <p className="mt-1 text-xs text-muted-foreground">Uses bundled EVVM bytecodes and link references for deterministic contract deployment.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <Landmark className="mb-3 h-4 w-4 text-primary" />
            <p className="text-xs font-semibold">Registry handoff</p>
            <p className="mt-1 text-xs text-muted-foreground">Registers the deployed EVVM on the official Sepolia registry after Arc deployment finishes.</p>
          </div>
        </div>

        {!isConnected ? (
          <div className="relative flex justify-center">
            <ConnectButton />
          </div>
        ) : (
          <Button
            onClick={() => navigate('/deploy')}
            className="relative h-10 px-6 gap-2 glow-primary"
          >
            Start Deploying
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </motion.div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * (i + 1), ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Link
              to={feature.to}
              className="group block rounded-md border border-border bg-card p-5 hover:border-primary/30 hover:bg-card/80 transition-all brand-curve"
            >
              <feature.icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-primary mt-3 group-hover:gap-2 transition-all">
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Tech Stack */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-16 text-center"
      >
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Powered by</p>
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>EVVM v3</span>
          <span className="h-3 w-px bg-border" />
          <span>Arc Testnet</span>
          <span className="h-3 w-px bg-border" />
          <span>EIP-191</span>
          <span className="h-3 w-px bg-border" />
          <span>wagmi + viem</span>
        </div>
      </motion.div>
    </main>
  );
}
