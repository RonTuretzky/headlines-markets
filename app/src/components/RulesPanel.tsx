import { type MarketData, ContentField } from "../hooks/useMarkets";
import { fmtDate } from "../lib/format";

const FIELD_LABEL: Record<ContentField, string> = {
  [ContentField.Subject]: "Subject line",
  [ContentField.Body]: "Body",
  [ContentField.SubjectOrBody]: "Subject or body",
};

/** Polymarket's "Rules" section: verbatim resolution criteria + resolver transparency. */
export function RulesPanel({ m }: { m: MarketData }) {
  return (
    <div className="bread-card p-4" data-testid="rules-panel">
      <h3 className="mb-2 font-breadDisplay text-lg font-bold uppercase">Rules</h3>
      <p className="mb-3 whitespace-pre-wrap text-sm">{m.description}</p>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <span className="text-surface-grey-2">Condition</span>
        <span>
          <code className="bg-paper-1 px-1 py-0.5 font-mono text-caption">{m.contentRegex || "(per-source)"}</code>{" "}
          on the {FIELD_LABEL[m.contentField].toLowerCase()}
        </span>
        <span className="text-surface-grey-2">Threshold</span>
        <span>
          {m.threshold} of {m.sources.length} newspapers
        </span>
        <span className="text-surface-grey-2">Sources</span>
        <span>
          {m.sources.map((s, i) => (
            <span key={i} className="mr-2 inline-block">
              <b>{s.name}</b>{" "}
              <code className="bg-paper-1 px-1 font-mono text-caption">
                d={s.dkimDomain}
                {s.fromRegex ? ` from~/${s.fromRegex}/` : ""}
              </code>
              {s.contentRegex && (
                <code className="ml-1 bg-paper-1 px-1 font-mono text-caption">content~/{s.contentRegex}/</code>
              )}
            </span>
          ))}
        </span>
        <span className="text-surface-grey-2">Email window</span>
        <span>
          {fmtDate(m.windowStart)} → {fmtDate(m.deadline)}
        </span>
        <span className="text-surface-grey-2">NO buffer</span>
        <span>{Number(m.resolutionBuffer) / 3600} hours after deadline</span>
        <span className="text-surface-grey-2">Resolver</span>
        <span className="font-mono text-caption">{m.market} (this market contract — zkEmail proofs only)</span>
        <span className="text-surface-grey-2">Collateral</span>
        <span>
          {m.collateral.symbol} <span className="font-mono text-caption">({m.collateral.address})</span>
        </span>
        <span className="text-surface-grey-2">Creator</span>
        <span className="font-mono text-caption">{m.creator}</span>
        <span className="text-surface-grey-2">Opened</span>
        <span>{fmtDate(m.createdAt)}</span>
      </div>
    </div>
  );
}
