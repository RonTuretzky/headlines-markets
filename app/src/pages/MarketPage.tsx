import { Link, useParams } from "react-router-dom";
import { Chip } from "@breadcoop/ui";
import { ArrowLeft } from "@phosphor-icons/react";
import { statusBadge } from "../components/MarketCard";
import { LiquidityPanel } from "../components/LiquidityPanel";
import { PositionsPanel } from "../components/PositionsPanel";
import { ResolutionPanel } from "../components/ResolutionPanel";
import { RulesPanel } from "../components/RulesPanel";
import { TradeWidget } from "../components/TradeWidget";
import { Resolution, useMarket } from "../hooks/useMarkets";
import { fmtCents, fmtChance, fmtDate, fmtVol } from "../lib/format";

export function MarketPage() {
  const { id } = useParams();
  const { data: m, isLoading } = useMarket(Number(id));

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 text-surface-grey-2">Loading market…</div>;
  if (!m)
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="font-bold">Oops… we didn't forecast this. Market not found.</p>
        <Link to="/" className="text-core-orange underline">
          Back to markets
        </Link>
      </div>
    );

  const badge = statusBadge(m);
  const headline = m.resolution === Resolution.Yes ? 10n ** 18n : m.resolution === Resolution.No ? 0n : m.priceYes;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-surface-grey-2 hover:text-core-orange">
        <ArrowLeft size={14} /> All markets
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 text-caption font-bold uppercase ${badge.className}`}>{badge.label}</span>
            <Chip size="small">{m.matchedCount}/{m.threshold} sources matched</Chip>
          </div>
          <h1 className="font-breadDisplay text-3xl font-black leading-tight" data-testid="market-question">
            {m.question}
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-surface-grey-2">
            <span>{fmtVol(m.volume, m.collateral.decimals)}</span>
            <span>Ends {fmtDate(m.deadline)}</span>
            <span>Collateral: {m.collateral.symbol}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-breadDisplay text-5xl font-black text-system-green" data-testid="headline-price">
            {fmtCents(headline)}
          </div>
          <div className="text-sm font-bold text-surface-grey-2">{fmtChance(headline)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <ResolutionPanel m={m} />
          <RulesPanel m={m} />
          <LiquidityPanel m={m} />
        </div>
        <div className="space-y-6">
          <TradeWidget m={m} />
          <PositionsPanel m={m} />
        </div>
      </div>
    </div>
  );
}
