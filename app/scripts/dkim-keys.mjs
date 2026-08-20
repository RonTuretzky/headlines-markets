#!/usr/bin/env node
// Build contracts/deployments/dkim-keys.json — the real DKIM public keys the deploy
// script registers. Includes:
//   - the committed dev key, registered for every demo newspaper domain (so the
//     dev-signed fixtures verify), and
//   - the REAL New York Times key, fetched live from DNS (so a real NYT email verifies
//     against nytimes.com's actual published key).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { devPublicKey, dnsKeyToHex } from "./dkim.mjs";

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "contracts", "deployments", "dkim-keys.json");

const DEMO_DOMAINS = [
  "nytimes.com",
  "email.washingtonpost.com",
  "email.reuters.com",
  "mail.cnn.com",
  "mail.bloomberg.com",
  "mail.theguardian.com",
  "wsj.com",
  "apnews.com",
];

const dev = devPublicKey();
const keys = DEMO_DOMAINS.map((domain) => ({ domain, selector: "dev2026", ...dev }));

// real NYT key from DNS (best-effort; skipped if offline)
try {
  const sel = "scph20250409";
  const txt = execSync(`dig +short TXT ${sel}._domainkey.nytimes.com`)
    .toString()
    .replace(/"\s*"/g, "")
    .replace(/"/g, "")
    .trim();
  const p = /p=([A-Za-z0-9+/=]+)/.exec(txt)?.[1];
  if (p) {
    keys.push({ domain: "nytimes.com", selector: sel, ...dnsKeyToHex(p) });
    console.log(`added REAL nytimes.com key (selector ${sel})`);
  }
} catch {
  console.warn("DNS fetch of the real NYT key skipped (offline); fixtures still use the dev key");
}

writeFileSync(outPath, JSON.stringify({ count: keys.length, keys }, null, 2));
console.log(`wrote ${keys.length} keys -> ${outPath}`);
