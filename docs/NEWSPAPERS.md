# Newspaper email alerts — research, samples, and what to subscribe to

Research done 2026-08 via live DNS lookups (SPF/DMARC), archived-email indexes
(milled.com) and user reports. **No complete live raw email could be scraped**
(archives are captcha-gated), so the `.eml` files in `emails/` are high-fidelity
mocks assembled from the verified facts below. To get real ones, subscribe using the
last column and export a message via Gmail → *Show original* → *Download original* —
it will drop straight into the app's settle flow.

## What is verified vs inferred

**Verified from a real received email (2026-08-20, raw `.eml` in hand)** — a genuine
NYT *Today's Headlines* digest was run through the prover and used to settle a live
demo market end-to-end:

- **DKIM**: `d=nytimes.com; s=scph20250409; a=rsa-sha256` — the selector the DNS
  probing couldn't recover. SparkPost `scph`-prefixed selector, as predicted.
- **Key rotation**: the selector date-stamps the key's deployment (2025-04-09), i.e.
  NYT rotates keys but slowly — this one was still the active signer 16 months later.
  Live DNS shows it is RSA-4096. Rotated-out selectors disappear from DNS, so a
  production DKIMRegistry must *archive* keys with validity windows while they are
  live, or proofs of pre-rotation emails become unverifiable (backlog A2; zk.email's
  key-archive service exists for exactly this reason).
- **Sender (Today's Headlines digest)**: `todaysheadlines-noreply@nytimes.com`,
  display name "The New York Times". So NYT uses *per-product* local-parts:
  `nytdirect@` for classic alerts, `todaysheadlines-noreply@` for the digest —
  configure market From-regexes accordingly.
- **Subject format**: `Today's Headlines: <full headline sentence>`, RFC 2047
  B-encoded UTF-8 split across folded header lines (curly apostrophes and all).
- **Envelope**: bounce domain `bounce.nytimes.com` via `mta-*.sparkpostmail.com`;
  Gmail records `dkim=pass`, `spf=pass`, `dmarc=pass (p=REJECT)` — confirming the
  alignment property the market's `dkimDomain` check relies on.
- **Body**: quoted-printable HTML (~160KB) — the headline lives in the Subject and
  the `<title>`, so Subject-matching markets are the robust configuration.

The raw file itself is not committed (it contains the recipient's personal address
and per-recipient tracking tokens); it lives untracked under `.context/`.

**Verified (earlier research)**
- **NYT sender**: `nytdirect@nytimes.com`, display name "The New York Times" —
  NYT's long-standing alert/newsletter From address.
- **NYT subject format**: `Breaking News: <full one-sentence headline>`. Verbatim
  archived example (milled.com, Apr 14 2020): *"Breaking News: New York City's
  coronavirus death toll soared past 10,000 after officials added more than 3,700
  people presumed to have died of the virus."* (preserved as
  `emails/nyt-covid-2020-archived.eml`).
- **Sending domains/ESPs for all 9 outlets** — pulled live via `dig` (SPF records
  don't lie): see table.
- **DMARC policies** — every outlet except WSJ publishes `p=reject`, which forces
  DKIM alignment to the domains listed below. That is exactly the property the
  market's `dkimDomain` check relies on.

**Inferred / still needed from a real subscription**
- Exact From local-parts for everyone but NYT (`no-reply@…` vs `newsletters@…`) —
  which is why the preset From-regexes match the domain suffix, not a full address.
- DKIM **selectors** (only readable from a raw header; not needed by this system —
  the registry keys on domain, not selector).
- Full body templates.

## Source table (as configured in `app/src/data/newspapers.ts`)

| Outlet | DKIM/send domain (DNS-verified) | ESP | From (confidence) | Breaking-news email? |
|---|---|---|---|---|
| New York Times | `nytimes.com` (bulk via `e.nytimes.com`) | SparkPost + SES + Validity | `nytdirect@nytimes.com` **(verified)** | Breaking News Alerts (email) + briefings |
| Washington Post | `email.washingtonpost.com` | Amazon SES | `…@email.washingtonpost.com` (domain-verified) | **Yes — dedicated Breaking News Alerts newsletter** |
| Reuters | `email.reuters.com` | Sailthru | `…@email.reuters.com` (domain-verified) | Daily briefings; breaking via app push |
| CNN | `mail.cnn.com` / `email.cnn.com` | Zeta / SparkPost | `…@mail.cnn.com` (domain-verified) | **Yes — CNN Breaking News alerts** |
| Bloomberg | `mail.bloomberg.com` | Amazon SES | `…@mail.bloomberg.com` (domain-verified) | Evening Briefing etc. |
| The Guardian | `mail.theguardian.com` | Salesforce MC | `…@mail.theguardian.com` (domain-verified) | First Edition (daily) |
| WSJ | `wsj.com` / `dj.com` | Proofpoint | `…@wsj.com` (domain-verified; DMARC only `p=quarantine`) | Newsletters + alerts (account required) |
| AP | `apnews.com` | Validity | `…@apnews.com` (domain-verified) | Morning/Afternoon Wire |
| BBC | `newsletters.bbc.co.uk` | email-messaging.com | `…@newsletters.bbc.co.uk` (domain-verified) | News Briefing (no instant alerts) |

## Subscribe list (to collect real test emails)

Best instant-alert signal first:

1. **Washington Post — Breaking News Alerts** (sent as events unfold):
   https://www.washingtonpost.com/newsletters/breaking-news-alerts/
   (also U.S. News Alerts: https://www.washingtonpost.com/newsletters/national-news-alerts/)
2. **CNN — Breaking News alerts** (free account required):
   https://www.cnn.com/newsletters/breaking-news-alerts-signup
3. **New York Times** — newsletter center: https://www.nytimes.com/newsletters
   (Breaking News alert emails are managed from your NYT account; allowlist
   `nytdirect@nytimes.com`)
4. **WSJ**: https://www.wsj.com/newsletters
5. **The Guardian** — First Edition: https://www.theguardian.com/email-newsletters
6. **Reuters**: https://www.reuters.com/newsletters
7. **AP**: https://apnews.com/newsletters
8. **Bloomberg** — Evening Briefing: https://www.bloomberg.com/account/newsletters/evening-briefing
9. **BBC** — News Briefing: https://www.bbc.co.uk/newsletters

When a real one arrives: *Show original* → download → upload it on a market page (or
run `node app/scripts/prove-email.mjs your.eml`). If the DKIM `d=` domain differs
from the preset (e.g. NYT signs with `e.nytimes.com` on some streams), create the
market with that exact domain — the proof preview shows the parsed `d=` immediately.

## Sample `.eml` files in `emails/`

| File | Purpose |
|---|---|
| `nyt-fed-cut.eml` | Matching NYT alert (verified sender + subject format) — settles seed market 1 |
| `wapo-fed-cut.eml` | Matching WaPo alert — second source, reaches the 2-of-3 threshold |
| `reuters-fed-cut.eml` | Matching Reuters alert — spare third source |
| `nyt-daily-briefing-nonmatching.eml` | Valid NYT sender, non-matching content — negative test, rejected with `content regex mismatch` |
| `nyt-covid-2020-archived.eml` | The verbatim 2020 archived subject line — historical reference (outside seeded market windows) |

All carry structurally-faithful `DKIM-Signature` headers (`d=` set to the table's
domains) with mock `b=` values; the mock prover derives the nullifier from `b=`.
