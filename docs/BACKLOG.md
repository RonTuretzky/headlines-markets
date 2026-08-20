# Backlog — road to Polymarket parity

Grounded in a source-level review of Polymarket's stack (Gnosis CTF, `ctf-exchange`,
`uma-ctf-adapter`, `neg-risk-ctf-adapter`) and its product UX. Our engine —
permissionless market creation + permissionless zkEmail settlement — stays the
differentiator throughout; the backlog is everything around it.

Legend: **P0** = needed for any real deployment · **P1** = trading-experience parity
· **P2** = full product parity.

## A. Settlement engine (the zkEmail core)

| # | Item | Notes |
|---|---|---|
| A1 **P0** | **Real zkEmail verifier** | Replace `MockZKEmailVerifier` with zkEmail's Groth16 verifier; circuit proves DKIM over the alert email and exposes from/subject/body-slice + timestamp + nullifier as public signals. The contracts were shaped so this is a drop-in. |
| A2 **P0** | **Real DKIMRegistry** | zkEmail's registry with DNSSEC-oracle updates; key-rotation grace windows (papers rotate DKIM keys; an alert proven after rotation needs the *historical* key to validate — registry must keep validity intervals). |
| A3 **P0** | **Regex → circuit compilation** | ◐ *Architecture landed*: the compiled settlement path (`CompiledEmailProof` + `submitCompiledProof`) settles on pattern *commitments* with no onchain regex and no revealed content (~126k gas incl. resolution, measured). Remaining: real zk-regex circuit generation per pattern and a patternHash → Groth16 verifying-key registry replacing the mock hash check. |
| A4 **P1** | **Body handling beyond 4KB / HTML emails** | Real alerts are multipart HTML; define canonical text extraction inside the circuit (zkEmail's body-hash + slice approach) so "body" is well-defined adversarially. |
| A5 **P1** | **Settler incentive** | Creator-funded bounty paid to the address whose proof resolves the market (and to `resolveNo` caller), so settlement is economically automatic, like UMA proposer rewards. |
| A6 **P2** | **Dispute layer for oracle edge cases** | Spec assumes newspapers never publish conflicting emails. For parity with UMA's safety: optional escalation window where a bonded challenger can contest (e.g. claim the DKIM key leaked, or the email was retracted) before payouts finalize; escalates to a fallback oracle. |
| A7 **P2** | **Richer conditions** | Numeric captures with comparisons ("Fed cuts by `(\d+)` bps, ≥ 50"), NOT-conditions (market fails if a retraction email arrives), M-of-N across *different* regexes per source, time-ordered conditions ("A before B"). |

## B. Market/token layer

| # | Item | Notes |
|---|---|---|
| B1 **P1** | **Byte-compatible Gnosis CTF ids** | Adopt alt_bn128 collection derivation so positions are interoperable with deployed CTF tooling/indexers. |
| B2 **P1** | **NegRiskAdapter multi-outcome** | "Which paper reports it first?" / "Who wins the election?" — N linked binary conditions, wrapped collateral, NO-basket → YES conversions, exactly one YES. |
| B3 **P1** | **Proxy wallets + gasless UX** | Polymarket's relayer + proxy-wallet pattern (POLY_PROXY / Safe signature types) so users trade without holding gas. |
| B4 **P2** | **Collateral policy** | Per-market collateral is done; add fee-on-transfer/rebasing token guards, a curated collateral list in the UI, and native-token wrapping. |
| B5 **P2** | **Oracle-failure escape hatch** | If a market is unresolvable (all DKIM keys revoked mid-window), allow [1,1] 50/50 resolution after a long timeout so collateral is never stranded. |

## C. Trading venue

| # | Item | Notes |
|---|---|---|
| C1 **P1** | **CLOB (ctf-exchange port)** | EIP-712 signed orders, operator matching with MINT/MERGE/COMPLEMENTARY modes, onchain settlement, maker/taker fee schedule (symmetric `baseRate·min(p,1-p)`), nonce cancels. FPMM stays as bootstrap liquidity. |
| C2 **P1** | **Limit orders UI** | Price-in-cents + shares + expiration (GTC default), partial-fill disclosure, open-orders tab with cancel-all — Polymarket's exact grammar. |
| C3 **P2** | **Liquidity rewards** | LP incentive program (Polymarket's early FPMM rewards / current maker rebates). |

## D. Product & UX

| # | Item | Notes |
|---|---|---|
| D1 **P1** | **Price history charts** | Store trade events → chart with 1H/6H/1D/1W/1M/ALL tabs; display price = bid-ask midpoint (fallback last-trade when spread >10¢) once the CLOB exists. |
| D2 **P1** | **Real wallets** | RainbowKit/Privy via bread-ui-kit's `BreadUIKitProvider`/`LoginButton`/`Navbar` (the kit ships these; we currently use dev accounts). |
| D3 **P1** | **Portfolio depth** | Avg entry / Return (realized+unrealized) columns, history tab (Buy/Sell/Redeem/Split/Merge), P&L period filters, auto-redeem toggle. |
| D4 **P1** | **Resolution timeline UI** | Polymarket-style labeled timeline ("Proof 1/2 accepted → threshold reached → finalized"), plus an "email inbox" view rendering each accepted alert. |
| D5 **P2** | **Discovery** | Categories/tags, trending sort by 24h volume, comments, watchlists, embeds. |
| D6 **P2** | **Notifications** | Push/email when a tracked market gets a proof, resolves, or nears deadline. |
| D7 **P2** | **Settlement bot** | Reference daemon: IMAP-watch a mailbox subscribed to the alert lists (docs/NEWSPAPERS.md), auto-prove + auto-submit matching emails. Turns "permissionless" into "automatic". |

## E. Infrastructure

| # | Item | Notes |
|---|---|---|
| E1 **P0** | **Gas reality pass** | ◐ *Mostly done*: compiled settlement path (see A3) cuts settle gas 2M→126k; compiled evidence is event-only; RegexLib deploys once as an external library and `new` calls moved to deployer contracts, putting **every contract under EIP-170** (factory 42.5KB→3.2KB) — deploys on vanilla anvil with no flags. Remaining: EIP-1167 clones to cut per-market deploy cost, real Groth16 verify (~230k) replacing the mock check. |
| E2 **P0** | **Audit + invariant/fuzz suite** | The FPMM fee accounting and RegexLib parser are the two components most deserving adversarial review; add Foundry invariant campaigns (collateral conservation under random trade/fund/settle sequences). |
| E3 **P1** | **Indexer** | Subgraph/ponder for markets, trades, positions, volume — replaces the frontend's from-genesis log scans (fine on anvil, not on a real chain). |
| E4 **P2** | **Testnet + real-email dry run** | Deploy to a testnet, subscribe to the WaPo/CNN alert lists, settle a real market with a real breaking-news email through the real zkEmail prover — the full-fidelity rehearsal. |
