# EVVM Arc Deploy

A browser-based deploy console for launching EVVM instances on Arc Testnet, registering them on the official EVVM registry on Ethereum Sepolia, and managing deployment manifests and signature workflows.

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
- **Wallet/Web3:** wagmi, RainbowKit, viem
- **EVVM:** `@evvm/viem-signature-library`

## Prerequisites

- Node.js 18+
- npm
- A wallet that can connect to:
  - Arc Testnet
  - Ethereum Sepolia

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

1. Connect a wallet on Arc Testnet.
2. Fund that wallet for Arc Testnet transactions.
3. Configure EVVM metadata and admin addresses in the app.
4. Deploy the EVVM contracts on Arc.
5. Approve the wallet switch to Ethereum Sepolia for registry registration.
6. Approve the wallet switch back to Arc Testnet.

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
- `src/lib/wagmi.ts` - Arc Testnet and Sepolia wallet/network configuration
- `src/hooks/useEVVMDeployment.ts` - Deployment progress and persistence logic
- `src/components/` - Shared UI, wallet provider, navbar, and deploy cards

## Notes

- The deployer currently uses bundled EVVM bytecodes checked into `src/lib/contracts/bytecodes.ts`.
- Registry registration still occurs on Ethereum Sepolia because that is where the EVVM registry contract lives.
- The Vite dev server is configured for port `8080` in `vite.config.ts`.

## Lovable compatibility

This repo is set up to work with [Lovable](https://lovable.dev):

- Lovable syncs from the default branch, so keep the desired frontend on `main`.
- The app runs on port `8080`, which matches the configured local development expectations.
- The stack remains React + Vite + TypeScript + Tailwind with Lovable-compatible tooling.

## License

MIT License

Copyright (c) 2026 Arun Nadarasa
