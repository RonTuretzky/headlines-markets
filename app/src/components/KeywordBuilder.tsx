import { useEffect, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";

// Plain-words → regex builder: the creator lists headline phrases and the market
// matches an email whose subject contains ANY of them (case-insensitive, whitespace-
// flexible). Generates a pattern in the RegexLib subset (alternation of escaped
// literals with `\s+` for spaces) — no lookarounds, so it always compiles onchain.
export function phrasesToRegex(phrases: string[]): string {
  const parts = phrases
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex metacharacters
        .replace(/\s+/g, "\\s+"), // flexible whitespace between words
    );
  return parts.length ? `(?i)(${parts.join("|")})` : "";
}

export function KeywordBuilder({
  phrases,
  onChange,
}: {
  phrases: string[];
  onChange: (phrases: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...phrases, v]);
    setDraft("");
  };

  return (
    <div>
      <label className="text-caption font-bold uppercase text-surface-grey-2">
        Headline phrases — resolves YES if a subject contains any of these
      </label>
      <div className="mt-1 flex gap-2">
        <input
          data-testid="keyword-input"
          placeholder="e.g. Fed cuts rates"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="min-w-0 flex-1 border-2 border-surface-ink bg-paper-0 px-3 py-2 outline-none focus:border-core-orange"
        />
        <Button onClick={add} />
      </div>

      {phrases.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="keyword-list">
          {phrases.map((p, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 border-2 border-surface-ink bg-[#FBDED1] px-2 py-1 text-sm font-bold"
            >
              {p}
              <button
                aria-label={`Remove ${p}`}
                onClick={() => onChange(phrases.filter((_, j) => j !== i))}
                className="text-system-red hover:scale-110"
              >
                <Trash size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-caption text-surface-grey-2">
        Case-insensitive; spaces match flexibly. Add each way a paper might word it — “Fed cuts rates”,
        “Fed lowers rates”, “rate cut”. Switch to Advanced for full regex.
      </p>
    </div>
  );
}

function Button({ onClick }: { onClick: () => void }) {
  return (
    <button
      data-testid="keyword-add"
      onClick={onClick}
      className="flex items-center gap-1 border-2 border-surface-ink bg-core-orange px-3 py-2 text-sm font-bold text-white shadow-[0.125rem_0.125rem_0px_0px_#595959] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
    >
      <Plus size={14} weight="bold" /> Add
    </button>
  );
}

/** Best-effort reverse: turn a simple `(?i)(a|b|c)` alternation back into phrases so
 * toggling Advanced→Simple keeps the list when possible. */
export function useSyncedPhrases(regex: string, setRegex: (r: string) => void) {
  const [phrases, setPhrases] = useState<string[]>(() => regexToPhrases(regex));
  useEffect(() => {
    setRegex(phrasesToRegex(phrases));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases]);
  return [phrases, setPhrases] as const;
}

export function regexToPhrases(regex: string): string[] {
  const m = /^\(\?i\)\((.+)\)$/.exec(regex.trim());
  if (!m) return [];
  return m[1]
    .split("|")
    .map((p) => p.replace(/\\s\+/g, " ").replace(/\\(.)/g, "$1"))
    .filter(Boolean);
}
