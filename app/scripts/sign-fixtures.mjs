#!/usr/bin/env node
// Re-sign every sample .eml in emails/ with the committed dev DKIM key, so each fixture
// carries a REAL RSA signature that the onchain DKIMVerifier checks. The signing domain
// is taken from the From address (matching the market source's dkimDomain); the dev key
// is registered for these domains in the registry (scripts/dkim-keys.mjs).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { signEml } from "./dkim.mjs";

const emailsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "emails");
for (const f of readdirSync(emailsDir).filter((f) => f.endsWith(".eml"))) {
  const raw = readFileSync(join(emailsDir, f), "latin1");
  const from = /^From:.*?([^\s<>"]+@[^\s<>"]+)/im.exec(raw);
  if (!from) {
    console.warn(`skip ${f}: no From address`);
    continue;
  }
  const domain = from[1].split("@")[1].replace(/>.*$/, "");
  const signed = signEml(raw, { domain, selector: "dev2026" });
  writeFileSync(join(emailsDir, f), signed, "latin1");
  console.log(`signed ${f}  (d=${domain}, dev key)`);
}
