#!/usr/bin/env node
// Register discovered newspaper DKIM keys in a deployment's DKIMRegistry.
//   PRIVATE_KEY=0x… node scripts/register-dkim-keys.mjs [--network gnosis] [--keys ../docs/dkim-keys-public.json] [--include-archived] [--batch 25]
// Registers only keys currently LIVE in DNS (re-verified here, not trusted from the
// file) unless --include-archived. Permissionless, write-once per (domain, modulus);
// already-registered keys are skipped. Transactions are pipelined: `--batch` txs are
// sent back-to-back with manual nonces, then their receipts awaited. Without
// PRIVATE_KEY it only reports.
import { readFileSync } from "node:fs";
import { resolveTxt } from "node:dns/promises";
import { createPublicClient, createWalletClient, http, parseAbi, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis, sepolia } from "viem/chains";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const networkName = opt("network", "gnosis");
const keysPath = opt("keys", "../docs/dkim-keys-public.json");
const batchSize = Number(opt("batch", "25"));
const includeArchived = args.includes("--include-archived");
const registryOverride = opt("registry", null); // register into a specific DKIMRegistry address

const NETS = {
  gnosis: { chain: gnosis, rpc: "https://gnosis-rpc.publicnode.com" },
  sepolia: { chain: sepolia, rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
};
const net = NETS[networkName];
const deployment = JSON.parse(readFileSync(new URL(`../../contracts/deployments/${networkName}.json`, import.meta.url), "utf8"));
const rpc = process.env.RPC_OVERRIDE ?? net.rpc;
if (registryOverride) deployment.dkimRegistry = registryOverride;
const abi = parseAbi([
  "function isDKIMPublicKeyHashValid(string domainName, bytes32 publicKeyHash) view returns (bool)",
  "function registerKey(string domainName, string selector, bytes exponent, bytes modulus) returns (bytes32)",
]);
const publicClient = createPublicClient({ chain: net.chain, transport: http(rpc, { batch: true }), batch: { multicall: true } });
const account = process.env.PRIVATE_KEY ? privateKeyToAccount(process.env.PRIVATE_KEY) : null;
const walletClient = account ? createWalletClient({ account, chain: net.chain, transport: http(rpc) }) : null;

const { records } = JSON.parse(readFileSync(keysPath, "utf8"));
const wanted = records.filter((r) => includeArchived || r.live);

// re-verify against DNS right now (never register from a stale file)
async function liveModulus(domain, selector) {
  try {
    const txt = (await resolveTxt(`${selector}._domainkey.${domain}`)).map((r) => r.join("")).join("");
    return /p=([A-Za-z0-9+/=]+)/.exec(txt.replace(/\s+/g, ""))?.[1] ?? null;
  } catch {
    return null;
  }
}

const valid = await publicClient.multicall({
  allowFailure: false,
  contracts: wanted.map((r) => ({ address: deployment.dkimRegistry, abi, functionName: "isDKIMPublicKeyHashValid", args: [r.domain, keccak256(r.modulus)] })),
});
let todo = wanted.filter((_, i) => !valid[i]);
// the registry is keyed by (domain, modulus): the same modulus under two selectors is one entry
const seen = new Set();
todo = todo.filter((r) => {
  const k = `${r.domain}|${r.modulus}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
console.log(`${networkName} registry ${deployment.dkimRegistry}: ${wanted.length} candidate keys, ${wanted.length - todo.length} already registered/duplicate, ${todo.length} to register${account ? "" : " (report only — no PRIVATE_KEY)"}`);

if (!includeArchived) {
  const checks = await Promise.all(todo.map((r) => liveModulus(r.domain, r.selector)));
  const dropped = todo.filter((_, i) => !checks[i]);
  for (const r of dropped) console.log(`  skip ${r.selector}._domainkey.${r.domain}: no longer in DNS`);
  todo = todo.filter((_, i) => checks[i]);
}
if (!account) {
  for (const r of todo) console.log(`  would register ${r.outlet} — ${r.selector}._domainkey.${r.domain} (${r.bits}-bit)`);
  process.exit(0);
}

let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
let done = 0;
const failed = [];
for (let i = 0; i < todo.length; i += batchSize) {
  const batch = todo.slice(i, i + batchSize);
  const sent = [];
  for (const r of batch) {
    try {
      const { request } = await publicClient.simulateContract({ account, address: deployment.dkimRegistry, abi, functionName: "registerKey", args: [r.domain, r.selector, r.exponent, r.modulus] });
      const hash = await walletClient.writeContract({ ...request, nonce: nonce++ });
      sent.push({ r, hash });
    } catch (e) {
      failed.push({ r, err: String(e.shortMessage ?? e.message).slice(0, 120) });
      console.log(`  ✗ ${r.selector}._domainkey.${r.domain}: ${String(e.shortMessage ?? e.message).slice(0, 120)}`);
    }
  }
  for (const { r, hash } of sent) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 240_000 });
      if (receipt.status !== "success") throw new Error("reverted");
      done++;
      console.log(`  ✓ ${r.outlet} — ${r.selector}._domainkey.${r.domain} (${r.bits}-bit)`);
    } catch (e) {
      failed.push({ r, err: String(e.shortMessage ?? e.message).slice(0, 120) });
      console.log(`  ✗ ${r.selector}._domainkey.${r.domain}: ${String(e.shortMessage ?? e.message).slice(0, 120)}`);
    }
  }
  console.log(`  … ${Math.min(i + batchSize, todo.length)}/${todo.length}`);
}
console.log(`registered ${done}, failed ${failed.length}`);
