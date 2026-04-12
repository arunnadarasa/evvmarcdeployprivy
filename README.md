# EVVM Arc Deploy

A browser-based deploy console for launching EVVM instances on Arc Testnet, registering them on the official EVVM registry on Ethereum Sepolia, and managing deployment manifests and signature workflows with Privy-authenticated wallets and ZeroDev-sponsored transactions.

## Overview

This frontend is adapted for:

- **Host chain:** Arc Testnet
- **RPC:** `https://rpc.testnet.arc.network`
- **Chain ID:** `5042002`
- **Explorer:** `https://testnet.arcscan.app`
- **Registry chain:** Ethereum Sepolia

The app uses bundled EVVM creation bytecodes plus client-side deployment logic to guide a full EVVM stack deployment from the browser.

## Features

- **Arc deployment flow**
  - Deploys the EVVM contract stack on Arc Testnet:
    - Staking
    - CoreHashUtils library
    - EVVM Core
    - Estimator
    - NameService
    - Treasury
    - P2PSwap
  - Runs contract initialization steps between Staking, Core, NameService, and Treasury
  - Switches to Ethereum Sepolia for `registerEvvm(...)`
  - Switches back to Arc Testnet after registry completion

- **Manifest dashboard**
  - Stores deployment records locally
  - Exposes contract addresses, tx hashes, and EVVM IDs
  - Exports deployment manifests as JSON

- **Signature tools**
  - Supports EVVM signing flows powered by `@evvm/viem-signature-library`
  - Includes EVVM principal-token faucet helpers for deployed testnet instances

- **Arc-focused UX**
  - Arc Testnet wallet targeting
  - Arcscan explorer links
  - Arc gas guidance for USDC-denominated transactions

## Tech stack

- **Frontend:** React 18, TypeScript, Vite 8
- **UI:** Tailwind CSS, shadcn/ui, Framer Motion
- **Wallet/Web3:** Privy, ZeroDev Kernel, viem
- **EVVM:** `@evvm/viem-signature-library`

## Prerequisites

- Node.js 18+
- npm
- A Privy app configured with social login providers
- A ZeroDev project for sponsored user operations

## Getting started

```bash
npm install
npm run dev
```

Default local dev server:

```text
http://localhost:8080
```

## Deployment flow

1. Sign in with Privy using social login.
2. Let Privy create an embedded wallet for the session.
3. Configure EVVM metadata and admin addresses in the app.
4. Deploy the EVVM contracts on Arc through ZeroDev-sponsored smart-account transactions.
5. Register the EVVM on Ethereum Sepolia through the same Privy-owned signer.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Create a development-mode build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |

## Project structure

- `src/pages/` - App screens for home, deploy, signatures, and dashboard
- `src/lib/contracts/` - Bytecodes, deploy orchestration, and registry interaction
- `src/lib/wagmi.ts` - Arc Testnet and Sepolia chain/public-client configuration
- `src/hooks/useEVVMDeployment.ts` - Deployment progress and persistence logic
- `src/hooks/useAppWallet.tsx` - Privy authentication, embedded wallet handling, and ZeroDev smart-account client creation
- `src/components/` - Shared UI, wallet provider, navbar, and deploy cards

## Notes

- The deployer currently uses bundled EVVM bytecodes checked into `src/lib/contracts/bytecodes.ts`.
- Registry registration still occurs on Ethereum Sepolia because that is where the EVVM registry contract lives.
- The app defaults to `VITE_PRIVY_APP_ID=cmmv0z6dv06bs0djs07c7vrl3` and `VITE_ZERODEV_PROJECT_ID=92691254-2986-488c-9c5d-b6028a3deb3a`, but you can override both with Vite env vars.
- The Vite dev server is configured for port `8080` in `vite.config.ts`.

## Lovable compatibility

This repo is set up to work with [Lovable](https://lovable.dev):

- Lovable syncs from the default branch, so keep the desired frontend on `main`.
- The app runs on port `8080`, which matches the configured local development expectations.
- The stack remains React + Vite + TypeScript + Tailwind with Lovable-compatible tooling.

## License

MIT License

Copyright (c) 2026 Arun Nadarasa
