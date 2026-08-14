# Architecture

Everything is designed around one substitution: **the oracle is an email**. Where
Polymarket outsources resolution to UMA's optimistic oracle (humans propose, dispute,
and escalate to a token vote), here the market contract verifies a zkEmail proof that
a configured newspaper actually sent a breaking-news alert matching a configured
regex — and reports payouts itself. Creation and settlement are both permissionless.

## Contracts (`contracts/src`)

### `lib/RegexLib.sol` — the onchain regex engine

The "mock regex lib": mock in the sense that production zkEmail compiles the pattern
into the circuit, but this is a real, working matcher. It parses the pattern with a
recursive-descent parser into node pools (atoms / sequences / alternations / char
classes) and matches via **NFA position-set simulation**: a `bool[input.length+1]`
marks every input offset the pattern could have consumed up to. Search semantics fall
out of seeding the set with all positions; `^`/`$` filter it. Quantifiers iterate to a
fixpoint, so matching always terminates — `(a+)+b` cannot blow up (there is no
backtracking), which matters because patterns are user-supplied and evaluated during
settlement.

Supported: literals, `.`, `[...]`/`[^...]` with ranges, `\d \D \w \W \s \S`, escaped
metacharacters, `\n \t \r \0`, groups `()`/`(?:)` (nested up to depth 16), alternation
`|`, `* + ? {m} {m,} {m,n}`, anchors `^ $`, global `(?i)` prefix. Rejected at parse
(so `validate()` catches them at creation): lookaround, backreferences, any escape we
don't implement (`\b \x \u \c`, `\1`), quantified anchors (`^*`), and groups nested
deeper than the matcher's EVM-stack limit. Intentional divergences from JS: a leading
`]` in a class is a literal (POSIX-style), and matching is byte-wise (ASCII).

Two guarantees back it:

- `validate()` runs at **market creation** and rejects anything the matcher couldn't
  execute — including deeply nested groups that would overflow the EVM stack — so a
  malformed pattern can never brick settlement later.
- `test/RegexDifferential.t.sol` ffi's every corpus case through **Node's own
  `RegExp`** (~1,600 curated pairs + fuzzed inputs) and asserts byte-for-byte
  agreement with the Solidity engine inside the documented subset.

### `zkemail/` — the proof layer

`EmailProof` mirrors zkEmail's production struct (`email-tx-builder`'s
`domainName / publicKeyHash / timestamp / emailNullifier / proof`), with the
regex-extracted fields a headline circuit would expose as public outputs: `fromAddress`,
`subject`, `bodyExcerpt` (bounded at 4KB, like the circuit's max body bytes).

- `MockDKIMRegistry` — domain → DKIM-key-hash validity, like zkEmail's DKIMRegistry.
  Two write paths: owner-set arbitrary hashes (production shape) and permissionless
  `registerMockKey(domain)` for the deterministic mock hash
  `keccak("MOCK_DKIM_KEY:"+domain)`, which keeps the whole demo permissionless.
- `MockZKEmailVerifier` — production shape (`registry check` → `proof check`), mock
  math: accepts `proof == keccak256(abi.encode(PROOF_DOMAIN, ...publicFields))`. The
  JS prover (`app/src/lib/prover.ts`, also the `prove-email.mjs` CLI) computes exactly
  that from a raw `.eml`. Swapping in the real Groth16 verifier + real registry
  upgrades the system to trustless settlement with **no other contract changes**.

### `tokens/ConditionalTokens.sol` — the Polymarket settlement layer

Reimplements Gnosis CTF restricted to how Polymarket actually uses it: flat 2-slot
conditions, elementary index sets (`0b01` YES, `0b10` NO), keccak-derived
collection/position ids (Gnosis's alt_bn128 collection hashing only matters for
nested conditions, which Polymarket never uses). API kept name-compatible:
`prepareCondition / splitPosition / mergePositions / reportPayouts /
redeemPositions`, ERC-1155 balances, payout-vector semantics (`[1,0]`, `[0,1]`,
`[1,1]` = 50/50). One collateral lock backs every complete set, so winning shares
always redeem at exactly 1 unit.

### `market/HeadlineMarket.sol` — market + oracle in one

Holds the settlement config (sources, regexes, threshold, window, deadline, buffer)
and is registered as its own condition's oracle in its constructor
(`questionId = keccak("HEADLINE_MARKET_V1", address(this))`).

Sources must have **distinct DKIM domains** (enforced in the constructor), so a
K-of-N "distinct newspapers" threshold can't be satisfied by one domain occupying two
slots.

`submitProof` check order: not resolved → valid source index → source not already
matched → **nullifier unused** (replay guard, per-market since one real email may
legitimately settle several markets) → verifier accepts → proof domain == source's
DKIM domain → email date within `[windowStart, deadline]` → From matches `fromRegex`
→ content matches the effective regex (per-source override, else market default;
against subject, body, or either). Accepting the K-th distinct source reports `[1,0]`.

`resolveNo()` requires `now > deadline + resolutionBuffer` — the buffer is a grace
period so late-arriving proofs of in-window emails can still settle YES before anyone
can force NO. `checkProof` is a view dry-run returning `(ok, reason)`; the frontend
calls it before spending a transaction, and settlement bots can too.

### `market/FPMM.sol` — trading venue

Gnosis `FixedProductMarketMaker` (Polymarket's original AMM), binary-specialised:

- `addFunding(amount, distributionHint, receiver)` splits collateral into complete
  sets. Initial funding may pass `distributionHint` to open at skewed odds (pool
  keeps `amount·hint[i]/maxHint` of side *i*, surplus tokens go back to the funder);
  follow-on funding keeps pool ratios and mints `amount·supply/maxBal` LP shares.
  The `receiver` parameter lets the factory fund on the creator's behalf.
- `buy` / `sell` preserve the constant product with ceil-division rounding in the
  pool's favor; `calcBuyAmount`/`calcSellAmount` are the quote views; slippage guards
  (`min` tokens out / `max` tokens in) on both.
- **Fees**: `fee` (1e18-scale, e.g. `2e16` = 2%) is charged in collateral on each
  trade and accrues to LP shares via accumulator-per-share accounting
  (`accFeesPerShare` + signed corrections on mint/burn/transfer — same scheme as
  MasterChef, simpler than Gnosis's feePoolWeight and equivalent in effect).
  `withdrawFees` is claimable any time; `removeFunding` auto-claims.
- `whileTrading` blocks buy/sell/addFunding once the condition has reported payouts,
  freezing stale-price trading at resolution (Polymarket freezes at resolution too).
  LP exit (`removeFunding` → position tokens → `redeemPositions`) stays open.
- Prices: `marginalPrice(i) = oppositeBalance / (yes + no)`, a 0..1 probability the
  UI shows in cents. LP shares are collateral-scale (Gnosis convention).

### `market/MarketFactory.sol`

`createMarket(params)` deploys the market (which self-registers its condition) and its
FPMM, optionally pulls `initialLiquidity` from the creator and funds the pool in the
same transaction (LP shares + any hint surplus go to the creator), and records the
pair in an enumerable registry. No allowlists, no admin.

### Deviations from production Polymarket (by design)

| Polymarket | Here | Why |
|---|---|---|
| CTFExchange: offchain operator-matched orderbook, EIP-712 orders | onchain FPMM | permissionless + self-contained e2e; orderbook is backlog |
| UMA optimistic oracle (propose/bond/dispute/DVM) | zkEmail proof of the alert email | the point of the project |
| USDC only | any ERC-20, per market | requested: configurable token management |
| NegRiskAdapter multi-outcome | binary only | backlog |

## Frontend (`app/`)

Vite + React + TypeScript. UI is [`@breadcoop/ui`](https://github.com/BreadchainCoop/bread-ui-kit)
(bread-ui-kit v2: Tailwind v4 theme import, Pogaca fonts, neo-brutalist Button/Chip/
Typography/Logo) with Polymarket's UX conventions layered on: prices always in cents
with `%` chance as the same number, green YES / red NO everywhere, the trade widget's
"To win $X" hero line, quick-add amount chips, a sacred Rules section (verbatim
criteria + resolver address), status badges, abbreviated volume, and a "You won —
Redeem" claim banner.

- Reads: viem `multicall` (a minimal `Multicall3` is deployed by the script since
  fresh anvil chains lack the canonical one) via react-query, 3s polling. Volume =
  sum of FPMM `Buy`/`Sell` event logs. Time gating uses **chain** time, not wall
  clock, so `evm_increaseTime` behaves.
- Writes: viem wallet clients over anvil's well-known dev accounts with an account
  switcher (real wallet connectors are backlog); every write simulates first for
  readable revert reasons.
- The prover runs **in the browser**: upload a raw `.eml` → parse headers (unfold,
  RFC 2047 subjects, quoted-printable bodies, DKIM `d=`/`b=` tags) → build the
  `EmailProof` → `checkProof` dry-run → submit. The same module powers the
  `prove-email.mjs` CLI.

## Testing

- **Foundry (71 tests)** — regex unit + differential-vs-JS (ffi) + fuzz;
  ConditionalTokens split/merge/report/redeem incl. 50/50 payouts; FPMM funding
  math, hint odds, invariant growth, fee accounting, slippage and resolution guards;
  HeadlineMarket acceptance/rejection matrix (wrong domain, wrong From, non-matching
  content, tampered proof, unregistered domain, out-of-window, replayed nullifier,
  duplicate source, per-source override, Subject-only mode), NO-path timing; two
  full-lifecycle e2e tests with collateral-conservation assertions; custom-collateral
  market.
- **Playwright (9 flows)** — on an isolated anvil+vite pair (ports 8548/5198,
  spawned per run): list/filter/search, faucet + account switch, buy (price impact),
  sell, add liquidity → earn fees → claim, create-market wizard (live regex tester),
  settle via `.eml` upload (non-matching rejected with onchain reason → 2-of-3
  resolves YES → redeem), portfolio, time-warped NO resolution.
