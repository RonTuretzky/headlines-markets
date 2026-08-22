#!/usr/bin/env node
// Settlement bot (backlog D7): turns "permissionless" into "automatic".
//
// Reads newspaper alert emails — from a mailbox over IMAP (Gmail app password) or
// from .eml files — parses each one's real DKIM signature, matches it against every
// live market on the deployment, dry-runs `checkProof` onchain, and submits
// `submitProof` for every accepted (market, source) pair. Also resolves NO on markets
// whose deadline + buffer has passed. If a sender's DKIM key (domain, selector) is
// not yet in the DKIMRegistry, the bot fetches it from DNS and registers it
// (permissionless), so key rotations never block settlement.
//
//   node scripts/settlement-bot.mjs --network gnosis --since 2d          # IMAP
//   node scripts/settlement-bot.mjs --network sepolia --eml ../emails/nyt-fed-cut.eml
//
// env: GMAIL_USER + GMAIL_APP_PASSWORD (IMAP; omit when using --eml)
//      PRIVATE_KEY  (sends registerKey/submitProof/resolveNo; omit => dry run)
//      RPC_OVERRIDE (optional RPC URL)
import { ImapFlow } from "imapflow";
import { resolveTxt } from "node:dns/promises";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis, sepolia } from "viem/chains";
import { parseEml, buildEmailProof } from "../src/lib/prover.ts";
import { dnsKeyToHex } from "./dkim.mjs";

// ----------------------------------------------------------------------------- args
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const emlFiles = args.flatMap((a, i) => (a === "--eml" ? [args[i + 1]] : []));
const networkName = opt("network", "gnosis");
const sinceSpec = opt("since", "2d");
const mailboxName = opt("mailbox", "[Gmail]/All Mail");
const outPath = opt("out", null);
const dryRun = flag("dry-run") || !process.env.PRIVATE_KEY;

const NETS = {
  gnosis: { chain: gnosis, rpc: "https://gnosis-rpc.publicnode.com" },
  sepolia: { chain: sepolia, rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
};
const net = NETS[networkName];
if (!net) throw new Error(`unknown network ${networkName}`);
const deployment = JSON.parse(readFileSync(new URL(`../../contracts/deployments/${networkName}.json`, import.meta.url), "utf8"));
const rpc = process.env.RPC_OVERRIDE ?? net.rpc;

// ----------------------------------------------------------------------------- chain
const factoryAbi = parseAbi(["function getAllMarkets() view returns ((address market, address fpmm)[])"]);
const marketAbi = parseAbi([
  "struct Source { string name; string dkimDomain; string fromRegex; string contentRegex; }",
  "struct EmailProof { string domainName; bytes32 publicKeyHash; uint256 timestamp; string fromAddress; string subject; string bodyExcerpt; bytes32 emailNullifier; bytes header; bytes signature; }",
  "function question() view returns (string)",
  "function contentRegex() view returns (string)",
  "function contentField() view returns (uint8)",
  "function getSources() view returns (Source[])",
  "function threshold() view returns (uint8)",
  "function matchedCount() view returns (uint256)",
  "function resolution() view returns (uint8)",
  "function windowStart() view returns (uint64)",
  "function deadline() view returns (uint64)",
  "function resolutionBuffer() view returns (uint64)",
  "function sourceMatched(uint256) view returns (bool)",
  "function nullifierUsed(bytes32) view returns (bool)",
  "function checkProof(uint256 sourceIndex, EmailProof proof) view returns (bool ok, string reason)",
  "function submitProof(uint256 sourceIndex, EmailProof proof)",
  "function resolveNo()",
]);
const registryAbi = parseAbi([
  "function isDKIMPublicKeyHashValid(string domainName, bytes32 publicKeyHash) view returns (bool)",
  "function registerKey(string domainName, string selector, bytes exponent, bytes modulus) returns (bytes32)",
  "event DKIMKeyRegistered(string domainName, bytes32 indexed publicKeyHash, string selector)",
]);

const publicClient = createPublicClient({ chain: net.chain, transport: http(rpc, { batch: true }), batch: { multicall: true } });
const account = process.env.PRIVATE_KEY ? privateKeyToAccount(process.env.PRIVATE_KEY) : null;
const walletClient = account ? createWalletClient({ account, chain: net.chain, transport: http(rpc) }) : null;
let nonce = account ? await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }) : 0;

async function send(desc, req) {
  if (dryRun) return { dry: true };
  const hash = await walletClient.writeContract({ ...req, nonce: nonce++ });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error(`${desc}: tx reverted (${hash})`);
  return { hash };
}

// ----------------------------------------------------------------------------- regex mirror
function toJsRegex(pattern) {
  let src = pattern;
  let flags = "";
  if (src.startsWith("(?i)")) {
    src = src.slice(4);
    flags = "i";
  }
  return new RegExp(src, flags);
}
const FIELD = { 0: "subject", 1: "body", 2: "subjectOrBody" };

// ----------------------------------------------------------------------------- markets
async function loadMarkets() {
  const records = await publicClient.readContract({ address: deployment.factory, abi: factoryAbi, functionName: "getAllMarkets" });
  const fields = ["question", "contentRegex", "contentField", "getSources", "threshold", "matchedCount", "resolution", "windowStart", "deadline", "resolutionBuffer"];
  const res = await publicClient.multicall({
    allowFailure: false,
    contracts: records.flatMap((r) => fields.map((functionName) => ({ address: r.market, abi: marketAbi, functionName }))),
  });
  const markets = records.map((r, i) => {
    const v = res.slice(i * fields.length, (i + 1) * fields.length);
    return {
      id: i,
      address: r.market,
      question: v[0],
      contentRegex: v[1],
      contentField: Number(v[2]),
      sources: v[3],
      threshold: Number(v[4]),
      matchedCount: Number(v[5]),
      resolution: Number(v[6]),
      windowStart: Number(v[7]),
      deadline: Number(v[8]),
      resolutionBuffer: Number(v[9]),
    };
  });
  const live = markets.filter((m) => m.resolution === 0);
  const matched = await publicClient.multicall({
    allowFailure: false,
    contracts: live.flatMap((m) => m.sources.map((_, si) => ({ address: m.address, abi: marketAbi, functionName: "sourceMatched", args: [BigInt(si)] }))),
  });
  let k = 0;
  for (const m of live) m.sourceMatched = m.sources.map(() => matched[k++]);
  return markets;
}

// ----------------------------------------------------------------------------- emails
function sinceDate(spec) {
  const m = /^(\d+)([dh])$/.exec(spec);
  if (!m) throw new Error(`bad --since ${spec} (use e.g. 2d or 12h)`);
  const ms = Number(m[1]) * (m[2] === "d" ? 86_400_000 : 3_600_000);
  return new Date(Date.now() - ms);
}

async function collectEmails(domains) {
  const out = [];
  if (emlFiles.length) {
    for (const f of emlFiles) out.push({ id: f, raw: readFileSync(f, "latin1") });
    return out;
  }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("set GMAIL_USER + GMAIL_APP_PASSWORD (or pass --eml files)");
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
  await client.connect();
  let box = mailboxName;
  try {
    await client.mailboxOpen(box);
  } catch {
    box = "INBOX";
    await client.mailboxOpen(box);
  }
  try {
    // One IMAP search per newspaper domain keeps the fetch to relevant mail only.
    const uids = new Set();
    for (const d of domains) {
      const found = await client.search({ since: sinceDate(sinceSpec), from: `@${d}` }, { uid: true });
      for (const u of found ?? []) uids.add(u);
    }
    if (uids.size) {
      for await (const msg of client.fetch([...uids], { uid: true, source: true }, { uid: true })) {
        out.push({ id: `${box}#${msg.uid}`, raw: msg.source.toString("latin1") });
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

// ----------------------------------------------------------------------------- DKIM keys
const keyCache = new Map(); // `${domain}|${selector}` -> publicKeyHash | null
let registeredKeys = null; // from DKIMKeyRegistered events: `${domain}|${selector}` -> hash

async function registryLookup(domain, selector) {
  if (!registeredKeys) {
    registeredKeys = new Map();
    const logs = await publicClient.getLogs({
      address: deployment.dkimRegistry,
      event: registryAbi.find((x) => x.type === "event" && x.name === "DKIMKeyRegistered"),
      fromBlock: BigInt(deployment.deployBlock ?? 0),
    });
    for (const l of logs) registeredKeys.set(`${l.args.domainName}|${l.args.selector}`, l.args.publicKeyHash);
  }
  const hash = registeredKeys.get(`${domain}|${selector}`);
  if (!hash) return null;
  const valid = await publicClient.readContract({ address: deployment.dkimRegistry, abi: registryAbi, functionName: "isDKIMPublicKeyHashValid", args: [domain, hash] });
  return valid ? hash : null;
}

async function ensureKey(domain, selector, log) {
  const ck = `${domain}|${selector}`;
  if (keyCache.has(ck)) return keyCache.get(ck);
  // 1. already registered (covers rotated-out selectors that DNS no longer serves)
  const known = await registryLookup(domain, selector);
  if (known) {
    keyCache.set(ck, known);
    return known;
  }
  // 2. fetch from DNS and register (permissionless)
  let txt;
  try {
    txt = (await resolveTxt(`${selector}._domainkey.${domain}`)).map((r) => r.join("")).join("");
  } catch (e) {
    log(`  DNS lookup failed for ${selector}._domainkey.${domain}: ${e.code ?? e.message}`);
    keyCache.set(ck, null);
    return null;
  }
  const p = /p=([A-Za-z0-9+/=]+)/.exec(txt)?.[1];
  if (!p) {
    log(`  no p= in DNS record for ${selector}._domainkey.${domain}`);
    keyCache.set(ck, null);
    return null;
  }
  const { modulus, exponent } = dnsKeyToHex(p);
  const hash = keccak256(modulus);
  const valid = await publicClient.readContract({ address: deployment.dkimRegistry, abi: registryAbi, functionName: "isDKIMPublicKeyHashValid", args: [domain, hash] });
  if (!valid) {
    log(`  DKIM key ${selector}._domainkey.${domain} not registered — registering${dryRun ? " (dry run)" : ""}`);
    const { request } = await publicClient.simulateContract({ account: account ?? undefined, address: deployment.dkimRegistry, abi: registryAbi, functionName: "registerKey", args: [domain, selector, exponent, modulus] });
    await send("registerKey", request);
  }
  keyCache.set(ck, hash);
  return hash;
}

// ----------------------------------------------------------------------------- main
const report = { network: networkName, dryRun, at: new Date().toISOString(), emails: 0, candidates: [], submitted: [], resolvedNo: [], skipped: [] };
const lines = [];
const log = (s) => {
  console.log(s);
  lines.push(s);
};

log(`# Settlement bot — ${networkName}${dryRun ? " (dry run)" : ""}`);
const markets = await loadMarkets();
const live = markets.filter((m) => m.resolution === 0);
log(`${markets.length} markets, ${live.length} unresolved`);

const domains = [...new Set(live.flatMap((m) => m.sources.map((s) => s.dkimDomain)))];
const emails = await collectEmails(domains);
report.emails = emails.length;
log(`${emails.length} candidate email(s) (${emlFiles.length ? "files" : `IMAP since ${sinceSpec}`})`);

for (const email of emails) {
  let parsed;
  try {
    parsed = parseEml(email.raw);
  } catch (e) {
    report.skipped.push({ email: email.id, reason: `unparseable: ${e.message}` });
    continue;
  }
  const subj = parsed.boundSubject;
  log(`\n## ${email.id}: d=${parsed.domain} s=${parsed.selector} from=${parsed.fromAddress}\n   "${parsed.subjectDisplay}"`);
  for (const m of live) {
    for (const [si, src] of m.sources.entries()) {
      if (src.dkimDomain !== parsed.domain || m.sourceMatched[si]) continue;
      // local mirror of the onchain checks (cheap pre-filter)
      const fromOk = !src.fromRegex || toJsRegex(src.fromRegex).test(parsed.fromAddress);
      const pattern = src.contentRegex || m.contentRegex;
      const field = FIELD[m.contentField];
      const re = toJsRegex(pattern);
      const contentOk =
        field === "subject" ? re.test(subj) : field === "body" ? re.test(parsed.bodyExcerpt) : re.test(subj) || re.test(parsed.bodyExcerpt);
      const timeOk = parsed.timestamp >= m.windowStart && parsed.timestamp <= m.deadline;
      if (!fromOk || !contentOk || !timeOk) continue;

      log(`   matches market #${m.id} "${m.question.slice(0, 70)}" via ${src.name}`);
      const hash = await ensureKey(parsed.domain, parsed.selector, log);
      if (!hash) {
        report.skipped.push({ email: email.id, market: m.id, reason: "DKIM key unavailable" });
        continue;
      }
      const proof = buildEmailProof(parsed, hash);
      const [ok, reason] = await publicClient.readContract({ address: m.address, abi: marketAbi, functionName: "checkProof", args: [BigInt(si), proof] });
      report.candidates.push({ email: email.id, market: m.id, source: src.name, ok, reason });
      if (!ok) {
        log(`   ✗ checkProof: ${reason}`);
        continue;
      }
      log(`   ✓ checkProof ok — submitting${dryRun ? " (dry run)" : ""}`);
      try {
        const { request } = await publicClient.simulateContract({ account: account ?? undefined, address: m.address, abi: marketAbi, functionName: "submitProof", args: [BigInt(si), proof] });
        const r = await send("submitProof", request);
        m.sourceMatched[si] = true;
        m.matchedCount++;
        report.submitted.push({ market: m.id, question: m.question, source: src.name, tx: r.hash ?? null, resolvesYes: m.matchedCount >= m.threshold });
        log(`   → proof ${dryRun ? "would be" : ""} accepted (${m.matchedCount}/${m.threshold})${m.matchedCount >= m.threshold ? " — MARKET RESOLVES YES" : ""}${r.hash ? ` tx ${r.hash}` : ""}`);
      } catch (e) {
        log(`   ✗ submit failed: ${String(e.shortMessage ?? e.message).slice(0, 160)}`);
        report.skipped.push({ email: email.id, market: m.id, reason: String(e.shortMessage ?? e.message).slice(0, 160) });
      }
    }
  }
}

// expired markets → NO
const now = Math.floor(Date.now() / 1000);
for (const m of live) {
  if (m.matchedCount >= m.threshold) continue;
  if (now > m.deadline + m.resolutionBuffer) {
    log(`\nmarket #${m.id} past deadline+buffer — resolving NO${dryRun ? " (dry run)" : ""}`);
    try {
      const { request } = await publicClient.simulateContract({ account: account ?? undefined, address: m.address, abi: marketAbi, functionName: "resolveNo" });
      const r = await send("resolveNo", request);
      report.resolvedNo.push({ market: m.id, question: m.question, tx: r.hash ?? null });
    } catch (e) {
      log(`   ✗ resolveNo failed: ${String(e.shortMessage ?? e.message).slice(0, 160)}`);
    }
  }
}

log(`\n---\nemails ${report.emails} · candidate pairs ${report.candidates.length} · proofs submitted ${report.submitted.length} · resolved NO ${report.resolvedNo.length} · skipped ${report.skipped.length}`);
if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
