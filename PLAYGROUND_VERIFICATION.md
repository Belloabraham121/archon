# Playground and execution verification

Verified on 2026-10-11 against the local source tree.

## Passed

- Backend unit/integration suite: **56 / 56 passed**.
- Backend TypeScript build: passed.
- Client ESLint: passed.
- Client production build: passed, including `/playground`.
- Playwright suite discovery: 19 tests are present across authentication, API keys, intents, decisions, policies, replay, operations, and demo execution.
- Safe browser inspection: the standalone playground renders the policy request form, wallet generator, and RPC broadcast form without a runtime rendering error.
- Policy template and policy-deletion source paths compile.
- Broadcast guard source path requires an intent that has passed policy/approval, simulation, connector and kill-switch checks before it accepts an already-signed raw transaction.

## Not executed — requires secure test setup

| Area | Why it was not executed | How to verify safely |
| --- | --- | --- |
| Playwright browser tests | The suite requires `E2E_PASSWORD` and a seeded local test account. No password was supplied. | Start backend/frontend, seed the dedicated E2E account, then run `E2E_PASSWORD=... npm run test:e2e` from `client/`. |
| Tempo testnet broadcast | A real broadcast needs a newly generated, funded **testnet-only** wallet, a correctly constructed and signed Tempo transaction, recipient, token/decimals, nonce, and fee fields. | Use a fresh wallet funded only by the Tempo testnet faucet. Evaluate an intent, simulate it, sign locally, then submit the raw transaction through the playground broadcast form. Confirm the returned hash on Tempo Testnet Explorer. |
| Mainnet or real-money broadcast | Not appropriate for automated testing and would require explicit transaction-level confirmation. | Validate first on Moderato testnet; keep mainnet RPC and funding separate and guarded by an explicit production release process. |

## Findings and fixes

### 1. Playground intent type validation — fixed

CUA reproduced the error. The API correctly accepted all five action types, but the playground was not sending its selected `type` field at all. The client now sends `type: action` with each `/v1/intents` request. Client lint and production build pass after the correction.

### 2. Organization is blank in a fresh playground tab

The playground imports the active organization from browser local storage. A new browser profile/tab that has not selected an organization in the dashboard has no value to import.

**Fix:** sign in in the same browser origin, select an organization in Dashboard → Organizations, then open `/playground`. The organization field will populate; it remains editable for scoped API-key testing.

### 3. Real Tempo payment construction is not yet automated

The backend can broadcast an already-signed raw EVM transaction after gates pass, but the playground does not yet construct a Tempo TIP-20 transfer, retrieve a nonce/balance, or sign a Tempo transaction from a wallet.

**Fix:** add a Tempo transaction builder using the current official Tempo SDK/transaction schema, then connect it to a browser wallet or external agent signer. Keep private keys out of Archon and out of server storage. Add E2E coverage against Moderato using faucet-only funds.

### 4. Other blockchain RPCs need configuration

Tempo Moderato is available by default through `TEMPO_RPC_URL` (defaulting to the official Moderato endpoint). Other EVM chains need trusted RPC endpoints in `ARCHON_RPC_URLS`, for example:

```text
ARCHON_RPC_URLS={"base":"https://your-trusted-rpc.example","arbitrum":"https://your-trusted-rpc.example"}
```

**Fix:** use provider-managed, chain-specific RPC URLs and test each chain with a testnet transaction before enabling a live environment.

## Credential note

Any API key or private key pasted into chat should be considered exposed. Revoke the API key and abandon that wallet for anything other than an unfunded throwaway test.
