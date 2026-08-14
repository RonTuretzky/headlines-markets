import { Link } from "react-router-dom";
import { Chip } from "@breadcoop/ui";
import { type MarketData, Resolution } from "../hooks/useMarkets";
import { fmtCents, fmtDate, fmtVol } from "../lib/format";

export function statusBadge(m: MarketData): { label: string; className: string } {
  if (m.resolution === Resolution.Yes) return { label: "Resolved YES", className: "bg-system-green text-white" };
  if (m.resolution === Resolution.No) return { label: "Resolved NO", className: "bg-system-red text-white" };
  if (m.deadline < m.chainNow) return { label: "Ended", className: "bg-surface-grey-2 text-white" };
  return { label: "Live", className: "bg-primary-jade text-white" };
}

export function MarketCard({ m }: { m: MarketData }) {
  const badge = statusBadge(m);
  return (
    <Link to={`/market/${m.id}`} data-testid={`market-card-${m.id}`} className="block">
      <div className="bread-card p-4 transition-transform hover:-translate-y-0.5">
        <div className="mb-2 flex items-center gap-2">
          <span className={`px-2 py-0.5 text-caption font-bold uppercase ${badge.className}`}>{badge.label}</span>
          <span className="text-caption text-surface-grey-2">
            {m.matchedCount}/{m.threshold} sources matched
          </span>
        </div>

        <h3 className="mb-3 min-h-12 font-breadDisplay text-lg font-bold leading-snug">{m.question}</h3>

        <div className="mb-3 flex gap-2">
          <div className="flex-1 border-2 border-system-green bg-[#eaf7e4] px-3 py-2 text-center">
            <div className="text-caption font-bold uppercase text-system-green">Yes</div>
            <div className="text-xl font-black text-system-green">{fmtCents(m.priceYes)}</div>
          </div>
          <div className="flex-1 border-2 border-system-red bg-red-0 px-3 py-2 text-center">
            <div className="text-caption font-bold uppercase text-system-red">No</div>
            <div className="text-xl font-black text-system-red">{fmtCents(m.priceNo)}</div>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {m.sources.map((s, i) => (
            <Chip key={i} size="small">
              <span className={m.sourceMatched[i] ? "font-bold text-system-green" : ""}>
                {m.sourceMatched[i] ? "✓ " : ""}
                {s.name}
              </span>
            </Chip>
          ))}
        </div>

        <div className="flex justify-between text-caption text-surface-grey-2">
          <span>{fmtVol(m.volume, m.collateral.decimals)}</span>
          <span>Ends {fmtDate(m.deadline)}</span>
        </div>
      </div>
    </Link>
  );
}
