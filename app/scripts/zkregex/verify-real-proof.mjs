#!/usr/bin/env node
// Integration check for the REAL zk-regex path (run after build-circuit +
// register-circuits): generates a Groth16 proof from a sample email and verifies
// it against the market onchain, plus the negative cases.
//
//   node scripts/zkregex/verify-real-proof.mjs [--rpc http://localhost:8547] [--submit]
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { parseEml, buildCompiledProof } from "../../src/lib/prover.ts";
import { buildRealCompiledProof, computePairHash } from "../../src/lib/realProver.ts";
import { deployment, abis } from "../../src/contracts/gen.ts";

const args = process.argv.slice(2);
const opt = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const RPC = opt("rpc", "http://localhost:8547");

const pub = createPublicClient({ transport: http(RPC) });
const rec = await pub.readContract({ address: deployment.factory, abi: abis.MarketFactory, functionName: "getMarket", args: [0n] });
const parsed = parseEml(readFileSync(new URL("../../../emails/nyt-fed-cut.eml", import.meta.url), "utf8"));

const FED = "(?i)fed (cuts|lowers|slashes) (interest )?rates";
const FROM = "^nytdirect@nytimes\\.com$";
const { pairHash } = computePairHash(FROM, 2, FED);
const base = new URL(`../../public/circuits/${pairHash}/`, import.meta.url);
const meta = JSON.parse(readFileSync(new URL("meta.json", base), "utf8"));

console.log("proving (real Groth16)…");
const t0 = Date.now();
const proof = await buildRealCompiledProof(
  parsed, meta, new URL("pattern.wasm", base).pathname, new URL("pattern.zkey", base).pathname,
);
console.log(`proved in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const check = (p) =>
  pub.readContract({ address: rec.market, abi: abis.HeadlineMarket, functionName: "checkCompiledProof", args: [0n, p] });

const [ok, reason] = await check(proof);
console.log("real proof:", ok ? "ACCEPTED (pairing check passed)" : `rejected: ${reason}`);
const mock = buildCompiledProof(parsed, { fromRegex: FROM, contentField: 2, contentPattern: FED });
const [okM, reasonM] = await check(mock);
console.log("mock proof:", okM ? "ACCEPTED (BAD!)" : `rejected: ${reasonM} (expected — circuit registered)`);
const [okT, reasonT] = await check({ ...proof, timestamp: proof.timestamp + 1n });
console.log("tampered binding:", okT ? "ACCEPTED (BAD!)" : `rejected: ${reasonT} (expected)`);
if (!ok || okM || okT) process.exit(1);

if (args.includes("--submit")) {
  const carol = createWalletClient({
    account: privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"),
    transport: http(RPC),
  }).extend(publicActions);
  const { request } = await carol.simulateContract({
    address: rec.market, abi: abis.HeadlineMarket, functionName: "submitCompiledProof", args: [0n, proof], account: carol.account,
  });
  const rcpt = await carol.waitForTransactionReceipt({ hash: await carol.writeContract(request) });
  console.log(`submitted: status=${rcpt.status}, gasUsed=${Number(rcpt.gasUsed).toLocaleString()}`);
}
process.exit(0);
