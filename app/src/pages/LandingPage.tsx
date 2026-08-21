import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Chip } from "@breadcoop/ui";
import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  Coins,
  EnvelopeSimple,
  FileMagnifyingGlass,
  LockSimpleOpen,
  Newspaper,
  Scales,
  SealCheck,
  UsersThree,
} from "@phosphor-icons/react";
import { IS_LOCAL } from "../config";

/**
 * LandingPage — the "Means of Prediction" front door.
 *
 * Follows the crowdstake.fun docs pattern: a numbered step-by-step story where
 * every step is paired with a bespoke, purely-CSS-animated illustration (the
 * `mop-*` keyframes in globals.css) instead of plain text. Animations loop
 * gently, read correctly in their resting state, and are disabled under
 * `prefers-reduced-motion` by the global reduce rule.
 */

const TICKER = [
  "Fed cuts rates by 25bps",
  "ECB holds rates steady",
  "Ceasefire agreement signed",
  "SpaceX Starship reaches orbit",
  "Supreme Court rules 6–3",
  "Bitcoin ETF approved",
  "Президент подписал закон",
  "UN passes climate resolution",
];

export function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <Hero />
      <HowItWorks />
      <TrustStrip />
      <FinalCta />
    </div>
  );
}

/* --------------------------------- Hero ---------------------------------- */

function Hero() {
  return (
    <section className="border-b-2 border-surface-ink bg-paper-0">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 text-center sm:pt-20">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <Chip size="small">
            <span className="flex items-center gap-1">
              <Newspaper size={12} /> settled by newspapers
            </span>
          </Chip>
          <Chip size="small">
            <span className="flex items-center gap-1">
              <SealCheck size={12} /> real DKIM, verified onchain
            </span>
          </Chip>
          <Chip size="small">
            <span className="flex items-center gap-1">
              <LockSimpleOpen size={12} /> {IS_LOCAL ? "local demo" : "live on Gnosis"}
            </span>
          </Chip>
        </div>

        <h1 className="font-breadDisplay text-5xl font-black uppercase leading-none tracking-tight sm:text-7xl">
          Means of
          <br />
          <span className="text-core-orange">Prediction</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-body text-surface-grey-2">
          Prediction markets settled by the newspapers themselves. When the headline breaks, the
          alert email the paper already sends to millions becomes the proof that resolves the
          market — its cryptographic signature checked onchain. No oracle committee. No judges.
          No one to bribe.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/markets">
            <Button data-testid="landing-browse">Browse markets</Button>
          </Link>
          <Link to="/create">
            <Button variant="secondary" data-testid="landing-create">
              Open a market
            </Button>
          </Link>
        </div>
      </div>

      {/* Headline ticker — the raw material of every market. */}
      <div className="border-t-2 border-surface-ink bg-surface-ink py-2 text-paper-main">
        <div className="mop-ticker flex w-max items-center gap-8 whitespace-nowrap">
          {[...TICKER, ...TICKER].map((h, i) => (
            <span key={i} className="flex items-center gap-2 font-breadDisplay text-sm font-bold uppercase tracking-wide">
              <EnvelopeSimple size={14} className="text-core-orange" weight="bold" />
              {h}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ How it works ------------------------------ */

type Step = {
  title: string;
  body: string;
  caption: string;
  Visual: () => ReactNode;
};

const STEPS: Step[] = [
  {
    title: "Ask a question about tomorrow's front page",
    body: "Anyone opens a market — no listing committee. Pick the newspapers you trust, phrase the headline condition in plain words, choose how many distinct papers must report it, and seed the pot with any stablecoin.",
    caption: "Plain words → onchain matcher · K-of-N papers",
    Visual: CreateVisual,
  },
  {
    title: "The crowd trades YES / NO",
    body: "Shares trade on an automated market maker, Polymarket-style. Prices are probabilities in cents: 68¢ on YES means the market believes there's a 68% chance the headline prints. Winning shares redeem for $1.",
    caption: "Price = probability · every trade moves the odds",
    Visual: TradeVisual,
  },
  {
    title: "News breaks — the paper emails everyone",
    body: "Newspapers already run the world's most battle-tested alert system: breaking-news emails, cryptographically signed (DKIM) by the newsroom's own mail servers so inboxes can trust them. That signature is the oracle.",
    caption: "The alert email millions receive is the proof",
    Visual: NewsVisual,
  },
  {
    title: "Anyone submits the email as proof",
    body: "Drop the raw .eml into the market — yours, or any subscriber's. The contract verifies the paper's real RSA-SHA256 DKIM signature onchain (the same check a mail server does) and runs the headline condition over the signed subject line.",
    caption: "RSA-SHA256 verified onchain · regex over the signed subject",
    Visual: ProofVisual,
  },
  {
    title: "The market settles itself",
    body: "When enough distinct newspapers are proven, the market resolves YES in the same transaction and winners redeem $1 per share. If the deadline passes unproven, anyone can resolve NO. The contract is the oracle — no human in the loop.",
    caption: "K-th proof → YES · deadline → NO · redeem $1",
    Visual: SettleVisual,
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center font-breadDisplay text-3xl font-black uppercase tracking-tight sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-body text-surface-grey-2">
          From question to payout with nothing in between but cryptography.
        </p>

        <ol className="mx-auto mt-12 max-w-5xl space-y-12 sm:space-y-16">
          {STEPS.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <li key={step.title} className="grid items-center gap-6 sm:gap-10 lg:grid-cols-2">
                <div className={`flex gap-5 ${flip ? "lg:order-2" : ""}`}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center border-2 border-surface-ink bg-core-orange font-breadDisplay font-black text-paper-main shadow-[0.25rem_0.25rem_0px_0px_#595959]">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-breadDisplay text-xl font-bold uppercase leading-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-body text-surface-grey-2">{step.body}</p>
                  </div>
                </div>

                <figure
                  className={`bread-card relative flex h-64 items-center justify-center overflow-hidden ${flip ? "lg:order-1" : ""}`}
                >
                  <step.Visual />
                  <figcaption className="absolute inset-x-4 bottom-2 truncate text-right text-caption font-medium text-surface-grey-2">
                    {step.caption}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* -------------------- 1 · Create: question + papers + words --------------- */

function CreateVisual() {
  const papers = ["Jacobin", "NYT", "WaPo"];
  return (
    <div className="w-full max-w-[19rem] px-4 pb-6">
      <div className="border-2 border-surface-ink bg-paper-main p-3 shadow-[0.25rem_0.25rem_0px_0px_#595959]">
        <div className="text-caption font-semibold uppercase text-surface-grey-2">Question</div>
        <div className="mt-0.5 overflow-hidden whitespace-nowrap font-bold">
          <span className="mop-type inline-block align-bottom">Fed cuts rates by October?</span>
          <span className="mop-caret ml-0.5 inline-block h-4 w-[2px] bg-core-orange align-middle" />
        </div>

        <div className="mt-3 text-caption font-semibold uppercase text-surface-grey-2">
          Sources · 2 of 3 must report
        </div>
        <div className="mt-1 flex gap-1.5">
          {papers.map((p, i) => (
            <span
              key={p}
              className="mop-paper flex items-center gap-1 border border-surface-ink bg-paper-0 px-2 py-0.5 text-caption font-bold"
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              <Newspaper size={11} weight="bold" className="text-core-orange" /> {p}
            </span>
          ))}
        </div>

        <div className="mt-3 text-caption font-semibold uppercase text-surface-grey-2">Condition</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {["“Fed cuts rates”", "“rate cut”"].map((w, i) => (
            <span
              key={w}
              className="mop-word border border-core-orange bg-core-orange/10 px-1.5 py-0.5 text-caption font-semibold text-core-orange"
              style={{ animationDelay: `${1.4 + i * 0.5}s` }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- 2 · Trade: living odds ------------------------- */

function TradeVisual() {
  return (
    <div className="w-full max-w-[17rem] px-4 pb-6">
      <div className="flex items-end justify-between">
        <span className="flex items-center gap-1 font-breadDisplay text-sm font-bold uppercase">
          <ChartLineUp size={15} weight="bold" className="text-core-orange" /> Live odds
        </span>
        <span className="mop-price-yes font-breadDisplay text-2xl font-black text-system-green" />
      </div>

      <div className="mt-2 flex h-5 w-full overflow-hidden border-2 border-surface-ink">
        <div className="mop-odds h-full bg-system-green/80" />
        <div className="h-full flex-1 bg-system-red/60" />
      </div>
      <div className="mt-1 flex justify-between text-caption font-semibold">
        <span className="text-system-green">YES</span>
        <span className="text-system-red">NO</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="mop-buy-pulse flex items-center justify-center gap-1 border-2 border-surface-ink bg-system-green/15 py-2 font-breadDisplay text-sm font-bold uppercase shadow-[0.125rem_0.125rem_0px_0px_#595959]">
          Buy YES
        </div>
        <div className="flex items-center justify-center gap-1 border-2 border-surface-ink bg-paper-main py-2 font-breadDisplay text-sm font-bold uppercase text-surface-grey-2 shadow-[0.125rem_0.125rem_0px_0px_#595959]">
          Buy NO
        </div>
      </div>
      <div className="mt-2 text-center text-caption text-surface-grey-2">
        $1 per winning share at settlement
      </div>
    </div>
  );
}

/* -------------------- 3 · News breaks: signed alert email ----------------- */

function NewsVisual() {
  return (
    <div className="flex w-full max-w-[19rem] items-center justify-between px-5 pb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="flex h-14 w-14 items-center justify-center border-2 border-surface-ink bg-paper-main shadow-[0.25rem_0.25rem_0px_0px_#595959]">
          <Newspaper size={26} weight="duotone" className="text-core-orange" />
        </span>
        <span className="text-caption font-bold">Newsroom</span>
        <span className="text-[10px] text-surface-grey-2">signs with its DKIM key</span>
      </div>

      <div className="relative h-10 flex-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="mop-mail absolute left-0 top-1/2 -translate-y-1/2 text-surface-ink"
            style={{ animationDelay: `${i * 0.9}s` }}
          >
            <EnvelopeSimple size={20} weight="fill" className="text-core-orange" />
          </span>
        ))}
        <span className="absolute inset-x-2 top-1/2 -z-10 border-t-2 border-dashed border-surface-grey" />
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="mop-inbox flex h-14 w-14 items-center justify-center border-2 border-surface-ink bg-paper-main shadow-[0.25rem_0.25rem_0px_0px_#595959]">
          <UsersThree size={26} weight="duotone" className="text-surface-ink" />
        </span>
        <span className="text-caption font-bold">Millions of inboxes</span>
        <span className="text-[10px] text-surface-grey-2">any subscriber holds the proof</span>
      </div>
    </div>
  );
}

/* ------------------ 4 · Proof: scan the signature onchain ----------------- */

function ProofVisual() {
  return (
    <div className="w-full max-w-[18rem] px-4 pb-6">
      <div className="relative overflow-hidden border-2 border-surface-ink bg-paper-main p-3 shadow-[0.25rem_0.25rem_0px_0px_#595959]">
        <div className="flex items-center gap-1.5 text-caption font-bold">
          <FileMagnifyingGlass size={14} weight="bold" className="text-core-orange" />
          breaking-alert.eml
        </div>
        <div className="mt-1.5 space-y-0.5 font-mono text-[10px] leading-tight text-surface-grey-2">
          <div>From: nytdirect@nytimes.com</div>
          <div className="font-bold text-surface-ink">Subject: Breaking: Fed cuts rates</div>
          <div className="truncate">DKIM-Signature: d=nytimes.com; s=scph…</div>
          <div className="truncate">b=Kx91tPqA3f8Zw2…</div>
        </div>
        <span className="mop-scan absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-core-orange/25 to-transparent" />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="mop-seal flex items-center gap-1.5 border-2 border-system-green bg-system-green/10 px-2.5 py-1 text-caption font-bold text-system-green">
          <SealCheck size={14} weight="bold" /> Valid RSA-SHA256 · d=nytimes.com
        </span>
      </div>
      <div className="mt-1.5 text-center text-[10px] text-surface-grey-2">
        verified by the contract, not by us
      </div>
    </div>
  );
}

/* --------------------- 5 · Settle: threshold + redeem --------------------- */

function SettleVisual() {
  const sources = ["Jacobin", "NYT", "WaPo"];
  return (
    <div className="w-full max-w-[17rem] px-4 pb-6">
      <div className="text-caption font-semibold uppercase text-surface-grey-2">Proofs · 2 of 3</div>
      <div className="mt-1.5 flex gap-2">
        {sources.map((s, i) => (
          <span
            key={s}
            className={`${i < 2 ? "mop-source" : "opacity-40"} flex items-center gap-1 border border-surface-ink bg-paper-main px-2 py-1 text-caption font-bold`}
            style={{ animationDelay: `${i * 1.1}s` }}
          >
            <CheckCircle size={12} weight="bold" className={i < 2 ? "text-system-green" : "text-surface-grey"} />
            {s}
          </span>
        ))}
      </div>

      <div className="mop-resolve mt-4 border-2 border-system-green bg-system-green/10 p-2 text-center font-breadDisplay font-black uppercase text-system-green">
        Resolved YES
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="relative h-6 w-16">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="mop-coin absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-core-orange"
              style={{ animationDelay: `${2.6 + i * 0.4}s` }}
            />
          ))}
        </span>
        <span className="flex items-center gap-1 text-caption font-bold">
          <Coins size={14} weight="bold" className="text-core-orange" /> $1.00 / share
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ Trust strip ------------------------------- */

const TRUST = [
  {
    Icon: Scales,
    title: "No oracle committee",
    body: "The market contract is the oracle. Resolution is a cryptographic fact — a signature that verifies — not a vote that can be lobbied, bribed, or ignored.",
  },
  {
    Icon: LockSimpleOpen,
    title: "Permissionless, end to end",
    body: "Anyone can open a market on any set of newspapers, and anyone — a trader, a stranger, a bot — can settle one. All it takes is the email.",
  },
  {
    Icon: SealCheck,
    title: "Real cryptography, onchain",
    body: "Genuine RSA-SHA256 DKIM verification against the paper's published DNS key, via the modexp precompile — the same check every inbound mail server performs.",
  },
];

function TrustStrip() {
  return (
    <section className="border-y-2 border-surface-ink bg-paper-0 py-14">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-3">
        {TRUST.map(({ Icon, title, body }) => (
          <div key={title} className="bread-card p-5">
            <Icon size={26} weight="duotone" className="text-core-orange" />
            <h3 className="mt-2 font-breadDisplay text-lg font-bold uppercase leading-tight">{title}</h3>
            <p className="mt-2 text-sm text-surface-grey-2">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Final CTA ------------------------------- */

function FinalCta() {
  return (
    <section className="py-16 text-center">
      <h2 className="font-breadDisplay text-3xl font-black uppercase tracking-tight sm:text-4xl">
        Seize the means of prediction
      </h2>
      <p className="mx-auto mt-3 max-w-xl px-4 text-body text-surface-grey-2">
        The newspapers already print the truth on a schedule. Now anyone can build a market on it.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link to="/markets">
          <Button data-testid="landing-cta">
            <span className="flex items-center gap-2">
              Browse markets <ArrowRight size={16} weight="bold" />
            </span>
          </Button>
        </Link>
      </div>
    </section>
  );
}
