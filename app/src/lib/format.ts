// Polymarket display conventions: prices always in cents with the ¢ glyph,
// probability as the same number in %, "To win $X" payouts, abbreviated volume.

/** 1e18-scaled probability price -> "67¢" (sub-cent at the extremes: "0.7¢"). */
export function fmtCents(price1e18: bigint): string {
  const cents = Number(price1e18) / 1e16;
  if (cents > 0 && cents < 1) return `${cents.toFixed(1)}¢`;
  if (cents > 99 && cents < 100) return `${cents.toFixed(1)}¢`;
  return `${Math.round(cents)}¢`;
}

/** 1e18-scaled probability price -> "67% chance". */
export function fmtChance(price1e18: bigint): string {
  return `${Math.round(Number(price1e18) / 1e16)}% chance`;
}

/** Token base units -> "$1,234.56" (or without $ for share counts). */
export function fmtAmount(units: bigint, decimals: number, opts?: { dollar?: boolean; dp?: number }): string {
  const dp = opts?.dp ?? 2;
  const v = Number(units) / 10 ** decimals;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return opts?.dollar === false ? s : `$${s}`;
}

/** Abbreviated volume for cards: "$26M Vol.", "$770K Vol." */
export function fmtVol(units: bigint, decimals: number): string {
  const v = Number(units) / 10 ** decimals;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M Vol.`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K Vol.`;
  return `$${v.toFixed(0)} Vol.`;
}

export function fmtDate(unix: bigint | number): string {
  return new Date(Number(unix) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtCountdown(untilUnix: number): string {
  return fmtDuration(untilUnix - Math.floor(Date.now() / 1000));
}

export function fmtDuration(s: number): string {
  if (s <= 0) return "now";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Parse a "12.34" dollars string to token base units. */
export function parseAmount(input: string, decimals: number): bigint | null {
  const t = input.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  const [ints, fracRaw = ""] = t.split(".");
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  try {
    return BigInt(ints || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
  } catch {
    return null;
  }
}
