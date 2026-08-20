# DKIM key provenance: how trustless can it get?

*2026-08-20. Deep-dive for backlog A2 (real DKIMRegistry). Extends the rotation
findings in NEWSPAPERS.md. All DNS facts below were measured today via `dig` from
this machine; archive facts via `archive.prove.email` API.*

## 1. The claim, and the ceiling

The statement a registry must vouch for is:

> **P(D, s, K, [t₀,t₁])** — "the global DNS served key K at `s._domainkey.D`
> throughout the window [t₀,t₁]."

Two hard truths bound every design:

1. **DNS has no canonical state.** There is no root commitment to "what DNS says"
   (except where DNSSEC exists). Split-horizon, GeoDNS, anycast divergence and
   propagation mean two honest observers can see different answers at the same
   moment. Without the zone owner's signature, "truth" is only definable
   *observationally*: what k of n independent vantage points saw over a window.
2. **The ceiling is DNS itself.** An attacker who controls the zone (registrar,
   NS hijack) *is* the domain as far as DKIM is concerned — every mail receiver
   on earth accepts their mail too. An oracle can at best faithfully report DNS;
   it cannot exceed it. So the achievable goal is precisely: **close the gap
   between "what DNS actually served" and "what the registry believes," and make
   the residual trust small, ephemeral, and accountable.**

The Certificate Transparency insight applies: **trust can be made ephemeral even
when it can't be eliminated.** If every observation is committed to an immutable
log at observation time, observers are trusted only *at that instant*; afterwards
the record is math. A committee corrupted in 2027 cannot rewrite what it attested
in 2026. Corollary: history you didn't witness is unrecoverable trustlessly — you
cannot observe the past — so **every day the log isn't running is provenance
permanently lost** (this is the archival problem from NEWSPAPERS.md, inverted
into an action item).

Trilemma (pick 2): {no new trusted parties} × {works for arbitrary senders today}
× {covers history}. DNSSEC gives 1+3-going-forward for the few senders that have
it; observation quorums give 2+3-going-forward with minimized parties; archives
give 2+3 with full standing trust.

## 2. Measured reality (2026-08-20)

DNSSEC census (`dig +short DS`):

| Signed ✓ | Unsigned ✗ |
|---|---|
| outlook.com, proton.me, protonmail.com | nytimes.com, google.com, gmail.com, microsoft.com, yahoo.com, fastmail.com |
| irs.gov, ssa.gov, uscis.gov (OMB M-08-23 mandates DNSSEC for federal .gov) | sparkpostmail.com, sendgrid.net, mailgun.org, amazonses.com, mcsv.net (all five big ESP zones) |
| lead.bank, column.bank (fTLD requires DNSSEC for .bank/.insurance) | |

Selector-chain checks (`dig +dnssec TXT <sel>._domainkey.<d>`):

- **irs.gov / irs-20171230**: TXT directly RRSIG-signed, algorithm 8 (RSA/SHA-256
  — exactly what ENS's DNSSEC oracle verifies onchain). **Fully trustless
  end-to-end today.** Selector live since ≥2017.
- **proton.me / protonmail**: signed CNAME into `domains.proton.ch`, target also
  signed. Chain complete.
- **outlook.com / selector1**: signed CNAME into
  `outbound.protection.outlook.com` — but the target TXT has **no RRSIG**. The
  chain breaks at the last hop: you can trustlessly prove where outlook.com
  *points*, not what lives there. Partial provenance (shrinks the observation
  problem to one Microsoft zone).
- **nytimes.com**: no DNSSEC, selector is a plain TXT (not a CNAME), dual-provider
  DNS (NS1 + Route53 — multi-provider DNSSEC is operationally painful; don't
  expect them to sign soon).

Archive API (`archive.prove.email/api/key?domain=nytimes.com`):

- nytimes.com has **many concurrent live keys from ≥3 mail infrastructures**:
  SparkPost `scph*` (scph0118 died 2025-04-17 → scph20250409), `google` (Google
  Workspace corporate mail, live through 2026-06), `k1`/`k2` (Sailthru-era, k2
  still live 2026-06), `200608`. Consequence: a **domain-scoped** registry
  (NEWSPAPERS.md notes we key on domain, not selector) accepts a settlement email
  signed by *any* of these infrastructures — the attack surface is the union of
  all of them, including stale ones. Registry entries and market rules should be
  selector-family-scoped.
- Archive entries carry firstSeen/lastSeen windows but are a *trust-me database*:
  no commitments, single crawler.

Email artifacts (`emails/*.eml`):

- Real archived 2020 NYT email: single DKIM signature (d=nytimes.com only — **no
  ESP dual-signature**, so cross-signature bootstrapping via SparkPost's key is
  empirically dead for NYT; same for Reuters/Sailthru and WaPo). No ARC headers
  in our captures.
- SparkPost signatures carry **`t=` (signature timestamp)** — the 2020 email has
  it, as do the fixtures modeled on real headers. This enables in-circuit time
  binding (§4, T4).

## 3. The tiers, ranked by trust eliminated

### T0 — Authority-rooted: DNSSEC (the only true proof)
The zone owner signs the key record, chained to the ICANN root. Verifiable
onchain today (ENS DNSSEC oracle pattern; alg 8 & 13; ~10⁶ gas order, paid once
per rotation) or wrapped in a SNARK for gas. Unavailable for NYT and most
commercial senders — but **available today for .gov, .bank, Proton**. A single
sender opt-in (or an ESP signing its zone, inherited by every CNAME'd customer)
flips whole classes of senders to tier 0.

### T1 — Observation-rooted: notarized multi-vantage DNS quorum (the workhorse)
Manufacture the strongest substitute for a missing authority signature: many
independent, accountable observers.

- **zkTLS over DoH**: prove "a TLS session with a server holding a valid cert for
  `cloudflare-dns.com` returned TXT=K for this name at time t." Trust decomposes
  into: resolver honesty + notary non-collusion + WebPKI issuance (itself
  CT-logged). DoH responses aren't resolver-signed, so the TLS transcript binds
  resolver *identity* only — hence quorum across resolvers (Cloudflare, Google,
  Quad9) × notaries × vantages × repeated days. Opacity's MPC-TLS AVS is exactly
  this primitive with slashing rails already built.
- Onchain verification = operator signature checks: far cheaper than DNSSEC chain
  verification or SNARK verification.
- This upgrades zk.email's model from *one unauditable updater key* to *a
  diverse, bonded, cross-checking observer set*. The gap to DNS-truth shrinks to
  "corrupt several major resolvers simultaneously, persistently, unnoticed."

### T2 — Time-rooted: the witnessed history log (makes trust ephemeral)
Every observation (domain, selector, keyHash, resolver, vantage, t) appends to a
Merkle log; roots posted onchain daily (one storage write). Independent crawlers
(ours + zk.email's + anyone) cross-check; divergence is an alarm. Yields
non-equivocation, permanence (upstream deletion no longer destroys provability),
and ephemeral trust (later compromise can't rewrite committed history). This is
CT transplanted to DKIM. It converts the archive from "trust our database" to
"tamper-evident public record" for the cost of a cron job and a daily root.

### T3 — Verifier-concentration: ARC / mega-provider co-signatures
Gmail seals inbound mail with ARC (d=google.com, s=arc-20160816 — key live,
selector unchanged since 2016). The ARC-Message-Signature covers the message as
received; ARC-Authentication-Results contains Google's own `dkim=pass
header.d=nytimes.com` verdict rendered against DNS from Google's vantage at
receipt time. Verifying the ARC signature under Google's one key + regexing the
verdict collapses per-sender key provenance into provenance of **a single
ultra-watched, slow-moving key**. Different trust *shape*, not strictly less:
full trust in Google's verdict; requires the mail to have transited a sealing
provider; google.com itself is unsigned DNS, so this path's root is still T1
observation — but of one key instead of thousands. Best used as a **redundant
second path**: high-value markets require the direct-DKIM path and the ARC path
to agree.

### T4 — Policy hardening against "DNS-true but malicious"
Perfect DNS fidelity doesn't save you from keys legitimately *in* DNS that
shouldn't settle markets: dangling-CNAME selector takeovers (attacker reclaims a
decommissioned ESP tenant → genuinely-published key for the victim domain),
brief insertions during a zone compromise, or stale parallel infrastructure keys
(nytimes.com's k1/k2). Cheap mitigations:

- **Key aging**: settlement-eligible only after N days of continuous quorum
  observation (kills insert-sign-remove and opportunistic takeovers).
- **Snapshot-at-market-open**: pin the observed key set at market creation; keys
  appearing mid-market enter via the aged path only.
- **In-circuit time binding**: expose DKIM `t=` as a public signal; registry
  enforces t ∈ key's observed validity window (small extension to the compiled
  E1 circuit).
- **Selector scoping**: market rules bind to a selector family (e.g. `scph*` =
  the newsroom's ESP), not the whole domain.
- Note "old key signs new key" remains impossible (RFC 6376 has no chaining);
  aging + window-binding + witnessed history is the honest synthetic substitute
  for key continuity.

### T5 — Accountability wrapper: evidence-carrying optimistic registration
Registration posts (keyHash, evidenceHash, bond); evidence = the T1 attestation
bundle. Happy path verifies nothing onchain (cheap). A challenge inside the
window forces full onchain verification of the pre-committed evidence (or a
DNSSEC counter-proof where available); the loser is slashed. Crucial framing: an
optimistic scheme is only as trustless as its challenge game's ground truth — the
ladder must bottom out at T0/T1. Watchers are natural: anyone holding the other
side of the market. "Optimistic" applies to *verification cost*, never to
*evidence collection* — evidence must be committed at registration time, because
DNS at challenge time may have legitimately moved on.

## 4. Composite design for this repo

1. **`WitnessedDKIMRegistry`** (replaces MockDKIMRegistry; = backlog A2): entries
   are (domain, selectorPattern, keyHash, trustTier, observedWindow,
   evidenceHash, bond, activatesAt). Markets declare `minTier` and aging at
   creation; settlement checks tier + window + in-circuit `t=`.
2. **Observer daemon now**: cron-resolve watched selectors via 3 DoH resolvers,
   append to a Merkle log, post the root daily, cross-check the zk.email archive
   API, alarm on divergence. Every day it isn't running is history lost.
3. **Opacity-notarized DoH attestations** as the T1 evidence format — the MPC-TLS
   rails and the EigenLayer slashing already exist in-house.
4. **T0 demo market on a DNSSEC sender** (irs.gov / ssa.gov): ENS-oracle-style
   DNSSEC proof registers the key with zero committee trust — the fully trustless
   end-to-end exists *today*, just not for NYT. It makes the trust dial concrete
   and puts the burden where it belongs ("sign your zone and markets on your word
   are trustless").
5. **ARC as a redundant verifier** for high-value settlements (two independent
   trust shapes must agree).

## 5. The honest one-liner

Key provenance cannot be trustless in the absolute: DNS has no canonical state
and NYT doesn't sign its zone. What we can do is shrink the trusted step to
"k independent, bonded observers agreed on what DNS served, at one instant,"
commit that instant immutably, and let everything afterward be mathematics.
Trust becomes **ephemeral, diverse, and slashable** instead of standing,
singular, and silent.
