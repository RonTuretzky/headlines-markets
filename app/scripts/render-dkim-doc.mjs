#!/usr/bin/env node
// Render docs/DKIM-KEYS.md from docs/dkim-keys-public.json (discover-dkim.mjs output).
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2] ?? "../docs/dkim-keys-public.json";
const dst = process.argv[3] ?? "../docs/DKIM-KEYS.md";
const { generatedAt, outlets, keys, liveKeys, outletsWithLiveKey, records } = JSON.parse(readFileSync(src, "utf8"));

const byOutlet = new Map();
for (const r of records) {
  if (!byOutlet.has(r.outlet)) byOutlet.set(r.outlet, []);
  byOutlet.get(r.outlet).push(r);
}
const fmtDate = (d) => (d ? d.slice(0, 10) : "—");

let md = `# Newspaper DKIM public keys

Generated ${generatedAt.slice(0, 10)} by \`app/scripts/discover-dkim.mjs\` from the
[ZK Email DKIM archive](https://archive.prove.email) (keys observed in real email) plus
live-DNS re-verification and ESP-selector brute-forcing. **${keys} RSA keys across
${outletsWithLiveKey}/${outlets} outlets have a key that is live in DNS right now** (${liveKeys} live keys).

- **live** = the selector currently resolves in DNS with this exact key → the outlet can
  sign email with it today; these are registered in the Gnosis + Sepolia DKIMRegistry
  by \`register-dkim-keys.mjs\` (permissionless, write-once per modulus).
- **archived** = seen historically by the archive but no longer in DNS (rotated out). Not
  registered; listed so pre-rotation emails can be supported once the registry gains
  validity windows (backlog A2).
- Source \`dns-brute\` = found by selector brute-force only (never seen by the archive).

Registry-ready data (modulus/exponent hex): \`docs/dkim-keys-public.json\`.

| Outlet | Region | Domain | Selector | Bits | Status | First seen | Last seen | Source |
|---|---|---|---|---|---|---|---|---|
`;
for (const [outlet, rs] of [...byOutlet.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const r of rs.sort((a, b) => Number(b.live) - Number(a.live) || a.domain.localeCompare(b.domain))) {
    md += `| ${outlet} | ${r.region} | \`${r.domain}\` | \`${r.selector}\` | ${r.bits} | ${r.live ? "**live**" : "archived"} | ${fmtDate(r.firstSeen)} | ${fmtDate(r.lastSeen)} | ${r.source} |\n`;
  }
}

const missing = [];
// outlets with no live key at all
const liveOutlets = new Set(records.filter((r) => r.live).map((r) => r.outlet));
for (const o of byOutlet.keys()) if (!liveOutlets.has(o)) missing.push(o);
md += `\n## Outlets without a live key found\n\n${
  missing.length ? missing.map((o) => `- ${o} (archived keys only)`).join("\n") : "_none_"
}\n\nOutlets absent from the table entirely had no key in the archive and no brute-forced selector — their
newsletters use a sending subdomain or ESP selector this sweep didn't guess. A single received email
reveals both (the \`d=\`/\`s=\` tags), and the settlement bot registers such keys from DNS on first sight.
`;
writeFileSync(dst, md);
console.log(`wrote ${dst} (${records.length} rows)`);
