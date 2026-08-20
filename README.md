# Headlines — prediction markets settled by the newspapers themselves

Binary prediction markets where **settlement is a zkEmail proof of a newspaper
breaking-news alert email**. Anyone can permissionlessly:

- **open a market** over any set of newspapers, any regex condition, any ERC-20
  collateral token, and
- **settle a market** by submitting a proof of a matching alert email (or resolve
  NO after the deadline).

The token layer reimplements the Conditional Tokens model Polymarket settles on;
trading runs through a Gnosis-style fixed-product AMM (Polymarket's original venue).
The zkEmail verifier and the onchain regex engine are mocks with production shapes —
see [Trust model](#trust-model--whats-mocked).

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

## Repo layout

| Path | What |
|---|---|
| `contracts/` | Foundry project: RegexLib, ConditionalTokens, HeadlineMarket, FPMM, factory, mocks, 71-test suite incl. a JS-differential regex test |
| `app/` | Vite + React frontend built with [`@breadcoop/ui`](https://github.com/BreadchainCoop/bread-ui-kit) (bread-ui-kit), viem, Playwright e2e |
| `emails/` | Sample `.eml` files (real verified senders/subject formats, mock DKIM sigs) |
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
cd contracts && forge test        # 71 tests: unit, integration, fuzz + JS-differential regex
cd app && pnpm e2e                # 9 Playwright flows on an isolated anvil (port 8548)
```

The mock prover also runs standalone:

```bash
cd app && node scripts/prove-email.mjs ../emails/nyt-fed-cut.eml   # .eml -> EmailProof JSON
```

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

Two permissionless settlement paths, enforcing identical conditions:

- **Transparent** — `submitProof(sourceIndex, EmailProof)`: the proof reveals the
  From/subject/body excerpt; the market runs the regexes *onchain* (RegexLib) and
  stores the quoted subject as evidence. ~2M gas (more with a long body). Great for
  demos and public evidence.
- **Compiled** (gas-real, private) — `submitCompiledProof(sourceIndex,
  CompiledEmailProof)`: the patterns are compiled *into the proving circuit*, which
  only produces a proof for a matching DKIM-signed email. Onchain the market just
  checks pattern commitments — no regex interpretation, no email content anywhere,
  evidence via event. **~126k gas including YES resolution** (≈355k with a real
  Groth16 pairing check) — a ~20-45x reduction.

Both dedupe by email nullifier (shared across paths) and count toward the same K-of-N
threshold; the K-th distinct source reports payout `[1,0]` to ConditionalTokens;
`resolveNo()` reports `[0,1]` after deadline + buffer. The market contract *is* the
oracle — no human or committee sits in the loop.

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

## Trust model — what's mocked

| Component | Here (demo) | Production |
|---|---|---|
| Email authenticity | `MockZKEmailVerifier`: proof = keccak of the public fields; DKIM keys are deterministic mock hashes, permissionlessly registrable | zkEmail Groth16 circuit proving a real DKIM signature; DKIMRegistry fed by a DNSSEC oracle |
| Regex | `RegexLib` interprets the pattern onchain over proof-revealed subject/body | pattern compiled into the zk circuit; only the match (or capture) is revealed |
| Everything else | ConditionalTokens, FPMM, factory, market lifecycle | identical — designed to swap the two mocks without touching the rest |

Assumed (per spec): each newspaper publishes one canonical truth and never emails
conflicting alerts. The threshold K exists so a single compromised newsroom email
pipeline can't settle a market alone. See the [backlog](docs/BACKLOG.md) for the
adversarial-case roadmap (disputes, bonds, UMA-style escalation).
