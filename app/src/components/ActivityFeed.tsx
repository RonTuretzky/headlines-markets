import type { TradeActivity } from "../hooks/usePriceHistory";
import type { MarketData } from "../hooks/useMarkets";
import { fmtAmount } from "../lib/format";

/** Polymarket-style activity list: who traded what at what price, newest first. */
export function ActivityFeed({ m, activity }: { m: MarketData; activity: TradeActivity[] }) {
  const dec = m.collateral.decimals;
  if (activity.length === 0) {
    return <p className="text-sm text-surface-grey-2">No activity yet.</p>;
  }
  return (
    <ul className="divide-y divide-paper-2" data-testid="activity-feed">
      {activity.slice(0, 25).map((a, i) => (
        <li key={`${a.txHash}-${i}`} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-24 shrink-0 font-mono text-caption text-surface-grey-2">{short(a.trader)}</span>
          {a.kind === "funding" ? (
            <span>
              added <b>{fmtAmount(a.amount, dec)}</b> liquidity
            </span>
          ) : (
            <span>
              {a.kind === "buy" ? "bought" : "sold"}{" "}
              <b className={a.outcome === 0 ? "text-system-green" : "text-system-red"}>
                {fmtAmount(a.shares, dec, { dollar: false, dp: 0 })} {a.outcome === 0 ? "Yes" : "No"}
              </b>{" "}
              at {Math.round(a.price * 100)}¢ ({fmtAmount(a.amount, dec)})
            </span>
          )}
          <span className="ml-auto shrink-0 text-caption text-surface-grey-2">{timeAgo(a.ts)}</span>
        </li>
      ))}
    </ul>
  );
}

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
