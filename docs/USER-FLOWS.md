# User flows

Every flow below is executed by the automated tests: contract-level in
`contracts/test/EndToEnd.t.sol`, browser-level in `app/e2e/flows.spec.ts` (9
Playwright tests on a fresh chain per run). Steps marked ⚙ are transactions.

## 1. Open a market (permissionless — anyone)

1. **Create** → 4-step wizard.
2. *Question*: title + optional resolution-rules text (auto-generated from the
   config if left blank, Polymarket-style "Rules" verbatim).
3. *Newspapers*: pick from presets with DNS-verified sending domains (NYT, WaPo,
   Reuters, CNN, Bloomberg, Guardian, WSJ, AP — see [NEWSPAPERS.md](NEWSPAPERS.md))
   or add any custom `{name, DKIM domain, From-regex}`. Choose the **K-of-N
   threshold** ("2 of 3 must report").
4. *Condition*: the content regex, which email field it applies to
   (subject/body/either), and a **live tester** — paste a hypothetical headline and
   see match/no-match as you type (browser `RegExp` mirrors the onchain subset).
5. *Market*: deadline, NO-buffer, initial liquidity, trading fee %, opening odds
   slider (5¢–95¢, becomes the FPMM `distributionHint`).
6. ⚙ Approve collateral (if seeding) → ⚙ `registerMockKey` for any unknown domains
   (mock-mode convenience) → ⚙ `createMarket` → land on the live market page.

Foundry coverage adds the validation matrix: bad thresholds, past deadlines, and
malformed regexes all revert at creation.

## 2. Trade (Polymarket-standard widget)

- **Buy**: pick Yes/No (buttons show live cent prices) → dollar amount (quick-add
  +$1/+$20/+$100/Max) → live quote: shares, average price, **"To win $X"** (shares ×
  $1) → ⚙ approve once → ⚙ `buy` with a 1% slippage floor. Errors are Polymarket's:
  "Not enough funds", "Must specify amount".
- **Sell**: shares in → "You'll receive $X" (the UI binary-searches
  `calcSellAmount` to invert the exact-collateral-out contract API) → ⚙ approve-all
  once → ⚙ `sell` with the share cap as the slippage guard.
- Trading freezes at resolution (`FPMM: market resolved`) — the widget swaps to a
  "Trading closed" card.

## 3. Provide liquidity

- ⚙ `addFunding` — follow-on funding keeps pool ratios; you may receive surplus
  outcome tokens back if the pool is skewed.
- Fees: trades accrue the market's fee to LP shares; "Claimable fees" shows your
  share; ⚙ `withdrawFees` any time (also auto-paid on removal).
- ⚙ `removeFunding` — burns LP shares for a proportional slice of both outcome
  pools (then merge or redeem). Works before and after resolution.

## 4. Settle YES (permissionless — anyone, not just traders)

1. Get the alert email raw: Gmail → ⋮ → *Show original* → *Download original*
   (`.eml`). Samples live in `emails/`.
2. Market page → Resolution panel → **upload the `.eml`**. The in-browser mock
   prover extracts DKIM domain, From, Subject, Date, body excerpt, nullifier and
   builds the proof.
3. The app maps the domain to the market's source slot and dry-runs `checkProof`,
   showing the exact acceptance verdict before any transaction — e.g.
   ✗ `content regex mismatch` for a Morning-Briefing email, ✓ for the breaking
   alert.
4. ⚙ `submitProof`. The source row flips to ✓ with the quoted subject, timestamp
   and submitter. When the K-th distinct newspaper is proven, the market resolves
   **YES** in the same transaction.

Contract tests cover the full rejection matrix (wrong domain/From/content, tampered
fields, unknown DKIM key, out-of-window dates, replayed emails, duplicate sources).

## 5. Settle NO (permissionless)

After `deadline + resolutionBuffer` with the threshold unmet, the Resolution panel
shows a countdown that becomes a **Resolve NO** button — ⚙ `resolveNo()` by anyone.
The buffer exists so in-window emails proven late still settle YES first.

## 6. Redeem

Resolved market → position panel shows Polymarket's claim banner: **"You won $X"** →
⚙ `redeemPositions` pays $1.00 per winning share (losing side clears at $0). Also
available per-row from the Portfolio page. LPs exit via remove-funding → redeem.

## 7. Portfolio

Positions across all markets (Market / Outcome / Qty / Current / Value + redeem
actions), LP rows with claimable fees, headline totals for position value and cash.

## 8. Wallet & cash (local dev)

Header: test-USDC **faucet** (+$10k), **account switcher** across anvil's dev
accounts (Alice/Bob/Carol) to play both sides of a market, live cash balance.
