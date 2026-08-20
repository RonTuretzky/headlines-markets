#!/usr/bin/env node
// Create a headline market matched to a real alert email, then settle it with the
// email's zkEmail proof — the full permissionless lifecycle from the CLI.
//
//   node scripts/create-market-from-email.mjs <email.eml> \
//     --question "U.S. national debt tops $40 trillion?" \
//     --regex "(?i)debt (hits|tops) \$40 trillion" \
//     [--source-name "The New York Times"] [--liquidity 5000] [--buy-yes 500] \
//     [--rpc http://localhost:8547] [--no-settle] [--compiled]
//
// --compiled settles via the compiled zk-regex path: pattern commitments only,
// no email content onchain, ~20x cheaper than the transparent path.
//
// The market's source is derived from the email itself (DKIM domain + exact From
// address), so the proof is guaranteed to target the right slot. The creator is
// anvil dev account #1 (Alice), the settler is #3 (Carol), the optional YES buyer
// is #2 (Bob) — mirroring the app's account switcher.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, publicActions, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildCompiledProof, mockKeyHash, parseEml, proveEml } from "../src/lib/prover.ts";
import { abis, deployment } from "../src/contracts/gen.ts";

const args = process.argv.slice(2);
const emlPath = args.find((a) => !a.startsWith("--"));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!emlPath || !opt("question") || !opt("regex")) {
  console.error(
    'usage: node scripts/create-market-from-email.mjs <email.eml> --question "..." --regex "..." ' +
      '[--source-name "..."] [--liquidity 5000] [--buy-yes 0] [--rpc url] [--no-settle]',
  );
  process.exit(1);
}

const RPC = opt("rpc", "http://localhost:8547");
const pub = createPublicClient({ transport: http(RPC) });
const wallet = (pk) =>
  createWalletClient({ account: privateKeyToAccount(pk), transport: http(RPC) }).extend(publicActions);
// anvil's canonical dev keys (local use only)
const alice = wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const carol = wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");

const send = async (client, req) => {
  const { request } = await client.simulateContract({ ...req, account: client.account });
  const hash = await client.writeContract(request);
  const rc = await client.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`tx reverted: ${req.functionName}`);
  return rc;
};

// 1. Prove the email.
const proof = proveEml(readFileSync(emlPath, "utf8"));
console.log(`proved email:
  domain    ${proof.domainName}
  from      ${proof.fromAddress}
  subject   ${proof.subject}
  date      ${new Date(Number(proof.timestamp) * 1000).toISOString()}
  nullifier ${proof.emailNullifier}`);

// 2. Escape the exact From address into an anchored regex for the source config.
const fromRegex = `^${proof.fromAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

// 3. Make sure the domain's mock DKIM key is registered (permissionless).
const registered = await pub.readContract({
  address: deployment.dkimRegistry,
  abi: abis.MockDKIMRegistry,
  functionName: "isDKIMPublicKeyHashValid",
  args: [proof.domainName, mockKeyHash(proof.domainName)],
});
if (!registered) {
  await send(carol, {
    address: deployment.dkimRegistry,
    abi: abis.MockDKIMRegistry,
    functionName: "registerMockKey",
    args: [proof.domainName],
  });
  console.log(`registered mock DKIM key for ${proof.domainName}`);
}

// 4. Alice creates the market.
const liquidity = parseUnits(opt("liquidity", "5000"), 6);
if (liquidity > 0n) {
  await send(alice, {
    address: deployment.usdc,
    abi: abis.TestUSDC,
    functionName: "approve",
    args: [deployment.factory, liquidity],
  });
}
const chainNow = (await pub.getBlock()).timestamp;
const question = opt("question");
const regex = opt("regex");
const params = {
  question,
  description:
    `Resolves YES if ${opt("source-name", proof.domainName)} sends an email whose subject matches ` +
    `/${regex}/, DKIM-signed by ${proof.domainName} from ${proof.fromAddress}, dated before the deadline. ` +
    `Settled permissionlessly by zkEmail proof; resolves NO 24h after the deadline otherwise.`,
  contentRegex: regex,
  contentField: 0, // Subject
  sources: [
    {
      name: opt("source-name", proof.domainName),
      dkimDomain: proof.domainName,
      fromRegex,
      contentRegex: "",
    },
  ],
  threshold: 1,
  windowStart: 0n, // any email date up to the deadline
  deadline: chainNow + 30n * 86400n,
  resolutionBuffer: 86400n,
  collateralToken: deployment.usdc,
  fee: 20000000000000000n, // 2%
  initialLiquidity: liquidity,
  distributionHint: [],
};
await send(alice, { address: deployment.factory, abi: abis.MarketFactory, functionName: "createMarket", args: [params] });
const marketId = (await pub.readContract({ address: deployment.factory, abi: abis.MarketFactory, functionName: "marketCount" })) - 1n;
const rec = await pub.readContract({
  address: deployment.factory,
  abi: abis.MarketFactory,
  functionName: "getMarket",
  args: [marketId],
});
console.log(`\nmarket #${marketId} created by Alice: "${question}"
  market ${rec.market}
  fpmm   ${rec.fpmm}
  regex  /${regex}/ on the subject, 1-of-1 source ${proof.domainName}`);

// 5. Optional: Bob buys YES before settlement.
const buyYes = parseUnits(opt("buy-yes", "0"), 6);
if (buyYes > 0n) {
  await send(bob, { address: deployment.usdc, abi: abis.TestUSDC, functionName: "approve", args: [rec.fpmm, buyYes] });
  await send(bob, { address: rec.fpmm, abi: abis.FPMM, functionName: "buy", args: [buyYes, 0n, 0n] });
  const shares = await pub.readContract({
    address: deployment.conditionalTokens,
    abi: abis.ConditionalTokens,
    functionName: "balanceOf",
    args: [await pub.readContract({ address: rec.market, abi: abis.HeadlineMarket, functionName: "yesPositionId" }), bob.account.address],
  });
  const price = await pub.readContract({ address: rec.fpmm, abi: abis.FPMM, functionName: "marginalPrice", args: [0n] });
  console.log(`Bob bought ${(Number(shares) / 1e6).toFixed(2)} YES for $${opt("buy-yes")}; YES now ${(Number(price) / 1e16).toFixed(0)}¢`);
}

if (args.includes("--no-settle")) {
  console.log("\n--no-settle: stopping before proof submission. Settle via the app or checkProof/submitProof.");
  process.exit(0);
}

// 6. Carol (uninvolved third party) settles permissionlessly with the proof.
const compiledMode = args.includes("--compiled");
const settleProof = compiledMode
  ? buildCompiledProof(parseEml(readFileSync(emlPath, "utf8")), {
      fromRegex,
      contentField: 0,
      contentPattern: regex,
    })
  : proof;
const [ok, reason] = await pub.readContract({
  address: rec.market,
  abi: abis.HeadlineMarket,
  functionName: compiledMode ? "checkCompiledProof" : "checkProof",
  args: [0n, settleProof],
});
if (!ok) {
  console.error(`\ncheck rejected the email: ${reason}`);
  process.exit(1);
}
const settleRc = await send(carol, {
  address: rec.market,
  abi: abis.HeadlineMarket,
  functionName: compiledMode ? "submitCompiledProof" : "submitProof",
  args: [0n, settleProof],
});
const resolution = await pub.readContract({ address: rec.market, abi: abis.HeadlineMarket, functionName: "resolution" });
console.log(
  `\nCarol settled via ${compiledMode ? "COMPILED (private)" : "transparent"} proof — resolution: ${["Unresolved", "YES", "NO"][resolution]} — gas used: ${settleRc.gasUsed.toLocaleString()}`,
);

// 7. Bob redeems if he bought.
if (buyYes > 0n) {
  const before = await pub.readContract({ address: deployment.usdc, abi: abis.TestUSDC, functionName: "balanceOf", args: [bob.account.address] });
  const conditionId = await pub.readContract({ address: rec.market, abi: abis.HeadlineMarket, functionName: "conditionId" });
  await send(bob, {
    address: deployment.conditionalTokens,
    abi: abis.ConditionalTokens,
    functionName: "redeemPositions",
    args: [deployment.usdc, conditionId, [1n, 2n]],
  });
  const after = await pub.readContract({ address: deployment.usdc, abi: abis.TestUSDC, functionName: "balanceOf", args: [bob.account.address] });
  console.log(`Bob redeemed winning YES shares for $${(Number(after - before) / 1e6).toFixed(2)} (paid $${opt("buy-yes")})`);
}
console.log(`\nopen http://localhost:5199/#/market/${marketId} to see it in the app`);
