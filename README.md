# Means of Prediction — markets settled by the newspapers themselves

*(formerly "Headlines")*

Binary prediction markets where **settlement is a zkEmail proof of a newspaper
breaking-news alert email**. Anyone can permissionlessly:

- **open a market** over any set of newspapers, any regex condition, any ERC-20
  collateral token, and
- **settle a market** by submitting a proof of a matching alert email (or resolve
  NO after the deadline).

The token layer reimplements the Conditional Tokens model Polymarket settles on;
trading runs through a Gnosis-style fixed-product AMM (Polymarket's original venue).
Settlement is **real DKIM verification**: an email's RSA-SHA256 signature is checked
onchain (modexp precompile) against the sending domain's real published public key —
the same operation an inbound mail server performs. The real New York Times key and a
real NYT email verify end to end.

```
┌─────────────┐   creates    ┌────────────────┐   oracle-reports   ┌───────────────────┐
│MarketFactory├─────────────▶│ HeadlineMarket │───────────────────▶│ ConditionalTokens │
└─────────────┘              │  (the oracle)  │    [1,0] / [0,1]   │  (CTF-style 1155) │
                             └───▲────────────┘                    └─────────▲─────────┘
                                 │ submitProof(EmailProof)                   │ split/merge/redeem
                          ┌──────┴───────────┐                     ┌─────────┴─────────┐
                          │MockZKEmailVerifier│                    │       FPMM        │
                          │ + MockDKIMRegistry│                    │ (YES/NO AMM pool) │
                          └──────────────────┘                     └───────────────────┘
```

## Live on Gnosis mainnet (chain 100)

**App: https://ronturetzky.github.io/means-of-prediction/** — a static GitHub Pages
bundle (no backend) that auto-indexes the deployment from
`contracts/deployments/gnosis.json`, reads markets live from Gnosis, and connects an
injected wallet to trade/settle. Rebuilt + redeployed by `.github/workflows/pages.yml`
on every push (same crowdstake.fun pattern).


Deployed 2026-08-21, **all contracts verified** on [gnosisscan.io](https://gnosisscan.io) (Blockscout):

| Contract | Address |
|---|---|
| MarketFactory | [`0xEb6dedbf1BCE0B0D60e7f807304AEA680925baA9`](https://gnosisscan.io/address/0xEb6dedbf1BCE0B0D60e7f807304AEA680925baA9) |
| ConditionalTokens | [`0x47CCC3b9e5A531f4cC30D0D6709C4aaD429F0f78`](https://gnosisscan.io/address/0x47CCC3b9e5A531f4cC30D0D6709C4aaD429F0f78) |
| DKIMRegistry | [`0x548427E025deBC88d816B37717002f1afD1c1E62`](https://gnosisscan.io/address/0x548427E025deBC88d816B37717002f1afD1c1E62) |
| DKIMVerifier | [`0x353eA8FF93D818E878b14451D657938DF4B00c1A`](https://gnosisscan.io/address/0x353eA8FF93D818E878b14451D657938DF4B00c1A) |
| HeadlineMarket impl | [`0x38570fca07b23ca49807d4456ce92eF042E87e8c`](https://gnosisscan.io/address/0x38570fca07b23ca49807d4456ce92eF042E87e8c) |
| FPMM impl | [`0xaD0f94e49A9BE09257A99497EE8B573E379e4fCC`](https://gnosisscan.io/address/0xaD0f94e49A9BE09257A99497EE8B573E379e4fCC) |
| First market ("Fed rate cut by October 2026?") | [`0x7024A123019CB2E83c168D37B0C7866e1b221C67`](https://gnosisscan.io/address/0x7024A123019CB2E83c168D37B0C7866e1b221C67) |

- Collateral: any ERC-20 — the app offers **WXDAI, USDC, USDC.e, sDAI, EURe** (all
  onchain-verified addresses) on Gnosis; the first market is seeded in WXDAI.
- The **real `nytimes.com` DKIM key** (selector `scph20250409`, from DNS) is registered
  in the mainnet DKIMRegistry — a real NYT email verifies against the mainnet
  `DKIMVerifier` (checked post-deploy). The throwaway demo dev key is registered for
  the sample-fixture domains; audit both in the registry's events.
- Run the app against mainnet: `cd app && pnpm build:gnosis` (or `DEPLOYMENT=gnosis
  pnpm sync && pnpm dev`); connect an injected wallet (MetaMask/Rabby) — the local
  faucet/dev accounts appear only on anvil.
- CI/CD via [etherform](https://github.com/BreadchainCoop/etherform):
  `.github/workflows/cicd.yml` runs build/test on every PR and deploys
  `script/DeployGnosis.s.sol` with Blockscout verification (repo secrets
  `PRIVATE_KEY` + `RPC_URL`). `contracts/script/verify-blockscout.mjs` re-verifies a
  manual deploy.

## Also live on Sepolia testnet (chain 11155111)

Same stack, free to try: faucet **TestUSDC** collateral, the demo DKIM key **and the real
NYT key** registered, and two seeded markets (the Fed-cut market settles with the sample
`.eml` fixtures). Switch networks from the header dropdown on the live app — the static
bundle embeds every deployment and picks via `localStorage`.

All contracts verified on [eth-sepolia.blockscout.com](https://eth-sepolia.blockscout.com):

| Contract | Address |
|---|---|
| MarketFactory | [`0x534bf057b115Ca133C982f42acDB3Fc8fe8B3b4b`](https://eth-sepolia.blockscout.com/address/0x534bf057b115Ca133C982f42acDB3Fc8fe8B3b4b) |
| ConditionalTokens | [`0x583f520E35BDA4caFeEa7d7a3b2f358d838789a5`](https://eth-sepolia.blockscout.com/address/0x583f520E35BDA4caFeEa7d7a3b2f358d838789a5) |
| DKIMRegistry | [`0xE8803065fA3eAa9aE82A839028a09535799e2ff7`](https://eth-sepolia.blockscout.com/address/0xE8803065fA3eAa9aE82A839028a09535799e2ff7) |
| DKIMVerifier | [`0x9fb26E84e98030bFc523ae60f5660B3287aEF2dB`](https://eth-sepolia.blockscout.com/address/0x9fb26E84e98030bFc523ae60f5660B3287aEF2dB) |
| TestUSDC (faucet) | [`0x0A29a562a2141b3bB209bDa1F53A1fC65DAB0742`](https://eth-sepolia.blockscout.com/address/0x0A29a562a2141b3bB209bDa1F53A1fC65DAB0742) |

Deploy your own: `node ../app/scripts/dkim-keys.mjs && forge script
script/DeploySepolia.s.sol:DeploySepolia --rpc-url $RPC --broadcast --private-key $PK`,
then `node script/verify-blockscout.mjs sepolia`. CI (`cicd.yml`) deploys this script on
PRs via etherform with the repo's `PRIVATE_KEY`/`RPC_URL` secrets (Sepolia); the Gnosis
mainnet deploy stays manual.

## See it in action

**Browse & trade** — market cards with live sparklines, a price-history chart with crosshair, and the Polymarket-style buy widget ("To win $X").

![browse and trade](docs/assets/browse-and-trade.gif)

**Open a market, permissionlessly** — pick newspapers and a Polymarket-style category, then write the condition three ways: **plain words**, raw **regex**, or **AI** — describe the condition in English and an LLM running entirely in your browser (Chrome's built-in model, else WebLLM on WebGPU) writes a long subset-safe regex, lint-checked, compiled and tested against your example headlines before it's accepted.

![create a market](docs/assets/create-market.gif)

**Settle with a real DKIM proof** — upload a signed `.eml`; its RSA-SHA256 signature is verified onchain against the newspaper's published key; the 2-of-3 threshold resolves the market YES.

![settle with a real DKIM proof](docs/assets/settle-dkim.gif)

## Repo layout

| Path | What |
|---|---|
| `contracts/` | Foundry project: RegexLib, ConditionalTokens, HeadlineMarket, FPMM, EIP-1167 factory, **real DKIM verification** (RSAVerify + DKIMRegistry + DKIMVerifier), 75-test suite |
| `app/` | Vite + React frontend built with [`@breadcoop/ui`](https://github.com/BreadchainCoop/bread-ui-kit) (bread-ui-kit), viem, Playwright e2e |
| `emails/` | Sample `.eml` files, DKIM-signed by the committed dev key (`pnpm dkim:sign-fixtures`) |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [User flows](docs/USER-FLOWS.md) · [Newspapers](docs/NEWSPAPERS.md) · [Polymarket-parity backlog](docs/BACKLOG.md) |

## Quickstart

Prereqs: [Foundry](https://getfoundry.sh), Node 22+, pnpm.

```bash
# 1. chain (vanilla anvil works: every contract is under EIP-170 and settlement
#    fits ordinary blocks since the compiled-proof path landed)
anvil --port 8547

# 2. contracts — deploys the stack + 3 seeded demo markets, writes deployments/local.json
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8547 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 3. app — syncs ABIs/addresses then serves on http://localhost:5199
cd ../app && pnpm install && pnpm dev
```

The header has a **faucet** (test USDC) and a **dev-account switcher** (Alice/Bob/Carol
= anvil's well-known accounts). To settle the seeded "Fed rate cut" market, open it and
upload `emails/nyt-fed-cut.eml`, then `emails/wapo-fed-cut.eml` — the second accepted
proof reaches the 2-of-3 threshold and resolves YES.

### Tests

```bash
cd contracts && forge test        # 75 tests: real RSA/DKIM, regex diff-vs-JS, CTF, FPMM, e2e
cd app && pnpm e2e                # 9 Playwright flows on an isolated anvil (port 8548)
```

The mock prover also runs standalone:

```bash
cd app && node scripts/prove-email.mjs ../emails/nyt-fed-cut.eml   # .eml -> EmailProof JSON
```

### Real zk-regex circuits (optional, ~10 min one-time ptau)

```bash
cd app
pnpm zk:build -- --from '^nytdirect@nytimes\.com$' --field 2 \
  --content '(?i)fed (cuts|lowers|slashes) (interest )?rates'   # regex -> DFA -> circom -> Groth16
pnpm zk:register        # deploy the generated verifier + register the pattern pair
pnpm zk:verify -- --submit   # prove a sample email for real and settle onchain (~2s prove, ~330k gas)
```

Once registered, the app's compiled settle mode generates the Groth16 proof
in-browser and the mock fallback is dead for that pattern.

## How settlement works

A market is configured at creation with:

- **sources** — up to 32 newspapers, each `{name, dkimDomain, fromRegex, contentRegex?}`,
- **contentRegex** — the headline condition, evaluated *onchain* by `RegexLib`
  (subset of JS regex: literals, `. * + ? {m,n}`, classes, groups, alternation,
  anchors, `\d \w \s`, `(?i)`); per-source overrides supported since papers word
  headlines differently,
- **contentField** — subject, body, or either,
- **threshold K** — distinct newspapers required for YES (aggregate settlement),
- **window / deadline / buffer** — accepted email `Date` range; after
  `deadline + buffer` anyone can resolve NO.

`submitProof(sourceIndex, EmailProof)` — the proof carries the email's canonicalized
signed headers + its real RSA signature. Onchain, `DKIMVerifier`:
1. looks up the sending domain's RSA public key in `DKIMRegistry` (real DNS keys),
2. verifies the RSA-SHA256 signature over the header bytes (`RSAVerify` + the modexp
   precompile) — genuine DKIM verification, and
3. binds the extracted From/Subject by requiring they appear in the authenticated
   header.
The market then runs its regex (onchain `RegexLib`) over the **DKIM-verified Subject**,
dedupes by email nullifier, and marks the source. The K-th distinct source reports
payout `[1,0]` to ConditionalTokens; `resolveNo()` reports `[0,1]` after deadline +
buffer. The market contract *is* the oracle — no human, committee, or mock in the loop.

A separate **zk-regex research track** (`app/scripts/zkregex`) compiles a pattern to a
real Groth16 circuit (regex → DFA → circom, differentially tested on 12k cases) toward
privacy-preserving settlement — see backlog A3; it is decoupled from the live path.

## Market token management

Follows the Polymarket/Gnosis standard:

- Each market is a 2-slot **condition**; YES/NO are ERC-1155 positions fully
  collateralised by the market's ERC-20 (`splitPosition` 1 → 1 YES + 1 NO,
  `mergePositions` back, `redeemPositions` at the reported payout after resolution).
- **Collateral is configurable per market** (test USDC by default; the e2e suite also
  exercises an 18-decimal token).
- Trading via a per-market **FPMM**: constant-product AMM over the YES/NO pool,
  configurable fee accruing to LP shares, `distributionHint` sets opening odds.
  Prices are probabilities — displayed in cents, Polymarket-style.

## Trust model — what's real, what's assumed

| Component | Here | Production delta |
|---|---|---|
| Email authenticity | **REAL** DKIM: RSA-SHA256 verified onchain (`RSAVerify` + modexp) against the domain's real public key in `DKIMRegistry`. The real NYT key + a real NYT email verify end to end. | Add key-rotation validity windows fed by a DNSSEC oracle (backlog A2); fold the DKIM RSA + SHA-256 into a zk circuit for private settlement (A1). |
| Test fixtures | The sample `.eml`s are signed by a **real** committed dev RSA key (`keys/dev-dkim.pub`), registered in the registry — real signatures, real verification, dev key (we can't hold NYT's private key). | Real senders sign their own real emails. |
| Regex | **REAL** onchain matcher (`RegexLib`) over the DKIM-verified Subject. | Compile to a zk circuit for privacy (A3; `app/scripts/zkregex` already does regex→DFA→Groth16). |
| Tokens / AMM / factory | **REAL** ConditionalTokens, FPMM, EIP-1167 clone factory. | Unchanged. |

Assumed (per spec): each newspaper publishes one canonical truth and never emails
conflicting alerts. The threshold K exists so a single compromised newsroom email
pipeline can't settle a market alone. Known limitation: only the **Subject** is bound
by the header signature — Body-field conditions need the DKIM body-hash (`bh=`) check
(backlog A4). See the [backlog](docs/BACKLOG.md) for the full roadmap.
