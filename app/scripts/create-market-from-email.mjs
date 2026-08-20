#!/usr/bin/env node
// Create a market matched to a real DKIM-signed email, then settle it with that email's
// real signature verified onchain — the full permissionless lifecycle from the CLI.
//
//   node scripts/create-market-from-email.mjs <email.eml> \
//     --question "U.S. national debt tops $40 trillion?" \
//     --regex "(?i)(u\.s\.|national) debt (hits|tops) \$40 trillion" \
//     [--source-name "The New York Times"] [--liquidity 5000] [--buy-yes 500] \
//     [--rpc http://localhost:8547] [--no-settle]
//
// The market condition matches the email's Subject (the field the DKIM signature binds).
// If the email's DKIM key isn't registered and it's a dev-signed fixture, the dev key is
// registered automatically. Alice creates, Bob optionally buys YES, Carol settles.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, publicActions, parseUnits, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseEml, buildEmailProof } from "../src/lib/prover.ts";
import { devPublicKey } from "./dkim.mjs";
import { abis, deployment } from "../src/contracts/gen.ts";

const args = process.argv.slice(2);
const emlPath = args.find((a) => !a.startsWith("--"));
const opt = (name, dflt) => (args.indexOf(`--${name}`) >= 0 ? args[args.indexOf(`--${name}`) + 1] : dflt);
if (!emlPath || !opt("question") || !opt("regex")) {
  console.error('usage: create-market-from-email.mjs <email.eml> --question "..." --regex "..." [--liquidity N] [--buy-yes N] [--no-settle]');
  process.exit(1);
}

const RPC = opt("rpc", "http://localhost:8547");
const pub = createPublicClient({ transport: http(RPC) });
const wallet = (pk) => createWalletClient({ account: privateKeyToAccount(pk), transport: http(RPC) }).extend(publicActions);
const alice = wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const carol = wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
const send = async (client, req) => {
  const { request } = await client.simulateContract({ ...req, account: client.account });
  const rc = await client.waitForTransactionReceipt({ hash: await client.writeContract(request) });
  if (rc.status !== "success") throw new Error(`tx reverted: ${req.functionName}`);
  return rc;
};

const parsed = parseEml(readFileSync(emlPath, "utf8"));
console.log(`email: d=${parsed.domain} s=${parsed.selector} from=${parsed.fromAddress}\n  subject: ${parsed.subjectDisplay}`);

const regEvent = parseAbiItem("event DKIMKeyRegistered(string domainName, bytes32 indexed publicKeyHash, string selector)");
async function keyHash() {
  const logs = await pub.getLogs({ address: deployment.dkimRegistry, event: regEvent, fromBlock: 0n });
  return logs.find((l) => l.args.domainName === parsed.domain && l.args.selector === parsed.selector)?.args.publicKeyHash;
}
let pkh = await keyHash();
if (!pkh && parsed.selector === "dev2026") {
  const dev = devPublicKey();
  await send(carol, { address: deployment.dkimRegistry, abi: abis.DKIMRegistry, functionName: "registerKey", args: [parsed.domain, parsed.selector, dev.exponent, dev.modulus] });
  pkh = await keyHash();
  console.log(`registered dev DKIM key for ${parsed.domain}`);
}
if (!pkh) { console.error(`no registered DKIM key for ${parsed.domain} (s=${parsed.selector})`); process.exit(1); }

const fromRegex = `^${parsed.fromAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
const liquidity = parseUnits(opt("liquidity", "5000"), 6);
if (liquidity > 0n) await send(alice, { address: deployment.usdc, abi: abis.TestUSDC, functionName: "approve", args: [deployment.factory, liquidity] });
const chainNow = (await pub.getBlock()).timestamp;
const regex = opt("regex");
await send(alice, {
  address: deployment.factory, abi: abis.MarketFactory, functionName: "createMarket",
  args: [{
    question: opt("question"),
    description: `Resolves YES if ${opt("source-name", parsed.domain)} sends an email whose subject matches /${regex}/, ` +
      `DKIM-signed by ${parsed.domain} from ${parsed.fromAddress}. Settled by a real DKIM RSA signature verified onchain.`,
    contentRegex: regex, contentField: 0,
    sources: [{ name: opt("source-name", parsed.domain), dkimDomain: parsed.domain, fromRegex, contentRegex: "" }],
    threshold: 1, windowStart: 0n, deadline: chainNow + 30n * 86400n, resolutionBuffer: 86400n,
    collateralToken: deployment.usdc, fee: 20000000000000000n, initialLiquidity: liquidity, distributionHint: [],
  }],
});
const marketId = (await pub.readContract({ address: deployment.factory, abi: abis.MarketFactory, functionName: "marketCount" })) - 1n;
const rec = await pub.readContract({ address: deployment.factory, abi: abis.MarketFactory, functionName: "getMarket", args: [marketId] });
console.log(`\nmarket #${marketId} created: "${opt("question")}"  (${rec.market})`);

const buyYes = parseUnits(opt("buy-yes", "0"), 6);
if (buyYes > 0n) {
  await send(bob, { address: deployment.usdc, abi: abis.TestUSDC, functionName: "approve", args: [rec.fpmm, buyYes] });
  await send(bob, { address: rec.fpmm, abi: abis.FPMM, functionName: "buy", args: [buyYes, 0n, 0n] });
  const price = await pub.readContract({ address: rec.fpmm, abi: abis.FPMM, functionName: "marginalPrice", args: [0n] });
  console.log(`Bob bought $${opt("buy-yes")} of YES; YES now ${(Number(price) / 1e16).toFixed(0)}¢`);
}
if (args.includes("--no-settle")) process.exit(0);

const proof = buildEmailProof(parsed, pkh);
const [ok, reason] = await pub.readContract({ address: rec.market, abi: abis.HeadlineMarket, functionName: "checkProof", args: [0n, proof] });
if (!ok) { console.error(`\ncheckProof rejected: ${reason}`); process.exit(1); }
const rc = await send(carol, { address: rec.market, abi: abis.HeadlineMarket, functionName: "submitProof", args: [0n, proof] });
const resolution = await pub.readContract({ address: rec.market, abi: abis.HeadlineMarket, functionName: "resolution" });
console.log(`\nCarol settled with a REAL DKIM proof — resolution: ${["Unresolved", "YES", "NO"][resolution]}, gas: ${Number(rc.gasUsed).toLocaleString()}`);
console.log(`\nopen http://localhost:5199/#/market/${marketId}`);
