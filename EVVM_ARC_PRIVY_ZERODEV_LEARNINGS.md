# EVVM Arc Privy + ZeroDev Learnings

This document captures the practical lessons from wiring EVVM deployment around:

- Privy social login and embedded wallets
- Arc Testnet contract deployment
- ZeroDev smart-account sponsorship
- Sepolia EVVM registry registration

It is written from the actual debugging path taken in this repo, including the failures that turned out to be useful signals.

## Final working shape

The flow that ended up working best is:

- Use Privy for social login and embedded wallet creation.
- Use the funded Privy wallet directly for Arc Testnet deployment and setup transactions.
- Use ZeroDev only for the Sepolia EVVM ID registration step.

In practice this was much more reliable than trying to force the entire Arc deployment path through sponsored account abstraction.

## Why this architecture won

The full EVVM deploy path on Arc is CREATE-heavy and involves multiple dependent deployments plus initialization writes.

That path exposed a long list of issues when routed through ZeroDev:

- unsupported or outdated helper methods
- v2 vs v3 RPC differences
- paymaster request shape mismatches
- sponsorship simulation failures
- prefund failures

By contrast:

- Privy embedded wallet auth worked well
- direct funded-wallet deployment on Arc worked
- ZeroDev remained useful for a narrower, smaller Sepolia registry write

The result is a cleaner division of responsibility:

- Privy owns user identity and wallet custody
- Arc deploys run as normal funded wallet transactions
- ZeroDev is used where sponsorship is tractable and worth keeping

## Major failures and what they taught us

### 1. `walletClient.deployContract is not a function`

Cause:

- ZeroDev Kernel clients are not plain EOAs and do not expose the same deploy helpers as normal wallet clients.

Learning:

- Smart-account deployment must use account-abstraction-aware transaction paths, not EOA assumptions.

Action taken:

- Added support for smart-account deploy behavior using encoded deploy calldata and smart-account send logic.

### 2. Old ZeroDev v2 assumptions broke on v3

Cause:

- Older bundler/paymaster method assumptions did not match the provided v3 chain endpoints.

Learning:

- For ZeroDev, the exact RPC version and endpoint shape matter.
- Use the chain-specific v3 endpoint consistently:
  - `https://rpc.zerodev.app/api/v3/<projectId>/chain/<chainId>`

Action taken:

- Updated Arc and Sepolia ZeroDev RPC builders to use the v3 chain endpoints.

### 3. `zd_*` helper method mismatches

Cause:

- The client code leaned on helper methods that were not available or not appropriate for the v3 endpoint path we were using.

Learning:

- Keep the ZeroDev integration narrow.
- Prefer the smallest number of custom hooks between viem and ZeroDev.

Action taken:

- Simplified the sponsorship path and moved toward direct `sponsorUserOperation(...)` usage.

### 4. Request payload rejected because of nested `chain`

Failure:

- ZeroDev rejected sponsored requests with validation errors because a nested `chain` object was being forwarded inside the user operation payload.

Learning:

- Even if viem types allow extra metadata, ZeroDev’s RPC request validator can reject those extra fields.
- Sanitize outgoing user-op payloads.

Action taken:

- Stripped unsupported `chain` fields before forwarding user operations to ZeroDev sponsorship methods.

### 5. `AA21 didn't pay prefund` on Arc

This was the biggest signal in the entire debugging process.

Meaning:

- The user operation reached sponsorship simulation, but the final sponsored operation still did not satisfy prefund requirements.

Likely causes:

- Arc sponsorship policy was not active for this ZeroDev project
- Arc support on the configured project was not sufficient for this deploy path
- the deployment user operation was too expensive or too complex for the paymaster policy

Learning:

- Once request-shape bugs are fixed, repeated `AA21` usually points to sponsorship support or policy limitations, not basic React wiring.
- Do not keep forcing a large deployment path through sponsorship once this pattern is clear.

Action taken:

- Switched Arc deployment back to the funded Privy wallet path.

### 6. Arc direct deploy stalled before hash returned

Observation:

- The UI could look frozen while waiting for wallet approval or broadcast, because the tx hash only appeared after submission.

Learning:

- For wallet-driven flows, separate:
  - preparing transaction
  - waiting for wallet approval
  - tx submitted
  - waiting for receipt

Action taken:

- Added deployment progress states that distinguish pre-broadcast waiting from post-broadcast receipt waiting.
- Added tx hash visibility and explorer links once available.

### 7. Browser runtime failure: `Buffer is not defined`

Cause:

- A browser-side dependency path used `Buffer`, but no browser global shim was present.

Learning:

- Modern Vite/browser builds do not guarantee Node globals.
- If a wallet/provider/deploy path ends up touching a library that expects `Buffer`, the app must polyfill it explicitly.

Action taken:

- Added a startup shim in `src/main.tsx`:
  - `globalThis.Buffer = Buffer`

### 8. Sepolia registration failed with `account.encodeCalls is not a function`

Cause:

- The sponsored registration path was still treating the smart-account client too much like a plain wallet `writeContract(...)` flow.

Learning:

- For ZeroDev Kernel registration writes, a direct `sendTransaction(...)` call with calldata is often safer than trying to push a plain contract write request through a path that expects full account methods.

Action taken:

- Changed Sepolia registration to:
  - precompute calldata for `registerEvvm(...)`
  - predict the EVVM ID with a read/call
  - send the actual sponsored transaction with `sendTransaction(...)`

### 9. Sepolia registration failed with `Message must be a non-empty string`

Cause:

- The smart-account signer path on Sepolia was not happy with the wrapper/signer shape we were using.

Learning:

- The ZeroDev Kernel signer works better with a provider-based owner/signing path than with a viem wallet wrapper in some flows.
- For Privy specifically, use the raw EIP-1193 provider directly when building the signer.

Action taken:

- Reworked the Sepolia smart-account signer to use a provider-based local adapter that exposes:
  - `signMessage`
  - `signTypedData`
  - `signAuthorization`

### 10. Sepolia sponsorship failed due to stale gas settings

Failure:

- Sponsored registration was rejected because `maxPriorityFeePerGas` was too low.

Learning:

- Do not override smart-account gas pricing with plain public-RPC EIP-1559 estimates when the bundler/paymaster has its own user-op gas pricing path.
- For sponsored AA transactions, let ZeroDev set the gas pricing unless there is a very strong reason not to.

Action taken:

- Removed the manual `estimateFeesPerGas` override from the ZeroDev smart-account client so it can use ZeroDev’s own user-operation gas price path.

## What worked reliably

### Privy

Reliable:

- social login
- embedded wallet creation
- chain switching
- funded-wallet deploy flow on Arc

Best use:

- authentication
- wallet ownership
- direct deploy signing on Arc

### ZeroDev

Reliable enough in this repo:

- narrower sponsored Sepolia registration direction

Unreliable for this repo:

- the full Arc EVVM deployment path

Best use:

- smaller sponsored account-abstraction actions
- registry or administrative writes on better-supported chains

## UI and product learnings

The deploy page needed clearer state transitions.

Helpful improvements that were added:

- immediate deployment status panel
- latest tx hash display
- copy tx hash
- open explorer link
- explicit pre-broadcast messages
- built-in funding instructions for the Privy wallet
- direct Circle faucet link for Arc deploy funding

These changes made debugging much easier and also make the product more usable for real users.

## Current intended workflow

1. User signs in with Privy social login.
2. User copies the Privy wallet address shown in the app.
3. User funds that wallet for Arc deployment through Circle Faucet.
4. App deploys the EVVM contracts and setup calls on Arc using the funded Privy wallet.
5. App switches to the Sepolia smart-account path and submits the sponsored `registerEvvm(...)` write through ZeroDev.

## Future best practices

### 1. Keep Arc deployment as a funded-wallet path

Unless ZeroDev sponsorship on Arc is explicitly proven for this project and policy, the funded-wallet approach is the better default.

### 2. Keep ZeroDev scoped to smaller Sepolia-style writes

This is where the value is clearest:

- sponsored registry writes
- smart-account administrative actions
- smaller predictable call payloads

### 3. Avoid broad custom paymaster abstractions

Prefer:

- one RPC family
- one sponsorship method
- minimal request mutation

The more custom glue exists between viem and ZeroDev, the harder debugging becomes.

### 4. Build diagnostics in layers

For future AA debugging, test in this order:

1. simple sponsored no-op call
2. tiny sponsored deploy
3. actual target transaction

This isolates whether the failure is:

- all sponsorship
- deployment sponsorship
- large initcode / expensive call sponsorship

### 5. Treat custom chains carefully

For less standard chains like Arc:

- avoid assuming mainstream AA behavior
- avoid assuming paymaster coverage
- avoid assuming factory paths behave identically

### 6. Keep runtime/browser shims explicit

If SDK or wallet code relies on Node-like globals:

- polyfill them intentionally at app startup
- do not wait for runtime crashes to reveal them

### 7. Surface wallet funding requirements in-product

Users should not have to infer:

- which address to fund
- which faucet to use
- whether the app expects a sponsored or funded transaction

The app should say it directly, which is what the current deploy screen now does.

## Final recommendation

For this repo and chain mix, the best mental model is:

- Privy is the wallet and login layer
- Arc deployment is a funded wallet transaction problem
- ZeroDev is a Sepolia sponsored registration tool

That split is simpler, more honest, easier to debug, and proved more reliable than trying to force a one-size-fits-all sponsored deployment architecture across every step.
