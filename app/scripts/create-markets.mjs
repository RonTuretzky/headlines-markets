#!/usr/bin/env node
// Batch-create markets on a live deployment from a JSON config list.
//   PRIVATE_KEY=0x… node scripts/create-markets.mjs <configs.json> [network]
//
// Each config: { ourQuestion, description, category, sources: [preset names],
//   threshold, contentRegex, contentField: "subject"|"subjectOrBody",
//   deadlineIso, windowStartZero }
// Markets are created with ZERO initial liquidity (anyone can fund via the app's
// Liquidity panel and set the opening odds). Every call is simulated first; a
// config that fails simulation is skipped and reported, not sent.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis, sepolia } from "viem/chains";

const [, , configPath, networkName = "gnosis"] = process.argv;
if (!configPath || !process.env.PRIVATE_KEY) {
  console.error("usage: PRIVATE_KEY=0x… node scripts/create-markets.mjs <configs.json> [gnosis|sepolia]");
  process.exit(1);
}

const NETS = {
  gnosis: { chain: gnosis, rpc: process.env.RPC_OVERRIDE ?? "https://rpc.gnosischain.com", collateral: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d" /* WXDAI */ },
  sepolia: { chain: sepolia, rpc: "https://ethereum-sepolia-rpc.publicnode.com", collateral: null /* deployment.usdc */ },
};
const net = NETS[networkName];
const deployment = JSON.parse(readFileSync(new URL(`../../contracts/deployments/${networkName}.json`, import.meta.url), "utf8"));
const factoryAbi = JSON.parse(
  readFileSync(new URL("../../contracts/out/MarketFactory.sol/MarketFactory.json", import.meta.url), "utf8"),
).abi;

// Preset newspaper sources (mirror of app/src/data/newspapers.ts).
const PRESETS = {
  Jacobin: { dkimDomain: "jacobin.com", fromRegex: "@jacobin\\.com$" },
  "The New York Times": { dkimDomain: "nytimes.com", fromRegex: "^(nytdirect|todaysheadlines-noreply)@nytimes\\.com$" },
  "The Washington Post": { dkimDomain: "email.washingtonpost.com", fromRegex: "@email\\.washingtonpost\\.com$" },
  Reuters: { dkimDomain: "email.reuters.com", fromRegex: "@email\\.reuters\\.com$" },
  CNN: { dkimDomain: "mail.cnn.com", fromRegex: "@mail\\.cnn\\.com$" },
  Bloomberg: { dkimDomain: "mail.bloomberg.com", fromRegex: "@mail\\.bloomberg\\.com$" },
  "The Guardian": { dkimDomain: "mail.theguardian.com", fromRegex: "@mail\\.theguardian\\.com$" },
  "The Wall Street Journal": { dkimDomain: "wsj.com", fromRegex: "@wsj\\.com$" },
  "Associated Press": { dkimDomain: "apnews.com", fromRegex: "@apnews\\.com$" },
};

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const publicClient = createPublicClient({ chain: net.chain, transport: http(net.rpc) });
const walletClient = createWalletClient({ account, chain: net.chain, transport: http(net.rpc) });

const configs = JSON.parse(readFileSync(configPath, "utf8"));
const collateral = net.collateral ?? deployment.usdc;
console.log(`creating ${configs.length} markets on ${networkName} as ${account.address} (collateral ${collateral})`);

const failures = [];
let created = 0;
for (const [i, c] of configs.entries()) {
  const sources = c.sources.map((name) => {
    const p = PRESETS[name];
    if (!p) throw new Error(`unknown source preset: ${name}`);
    return { name, dkimDomain: p.dkimDomain, fromRegex: p.fromRegex, contentRegex: "" };
  });
  const deadline = BigInt(Math.floor(new Date(c.deadlineIso).getTime() / 1000));
  const description = `${c.description.trim()}\n\n[category:${(c.category || "World").toLowerCase()}]`;
  const params = {
    question: c.ourQuestion,
    description,
    contentRegex: c.contentRegex,
    contentField: c.contentField === "subject" ? 0 : 2,
    sources,
    threshold: c.threshold,
    windowStart: c.windowStartZero ? 0n : BigInt(Math.floor(Date.now() / 1000)),
    deadline,
    resolutionBuffer: 86400n,
    collateralToken: collateral,
    fee: 20000000000000000n, // 2%
    initialLiquidity: 0n,
    distributionHint: [],
  };
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: deployment.factory,
      abi: factoryAbi,
      functionName: "createMarket",
      args: [params],
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("reverted");
    created++;
    console.log(`✓ [${i}] ${c.ourQuestion.slice(0, 70)} (${receipt.gasUsed} gas)`);
  } catch (e) {
    failures.push({ question: c.ourQuestion, error: String(e.message ?? e).slice(0, 200) });
    console.log(`✗ [${i}] ${c.ourQuestion.slice(0, 70)} — ${String(e.message ?? e).slice(0, 120)}`);
  }
}
console.log(`\ncreated ${created}/${configs.length}`);
if (failures.length) console.log("failures:", JSON.stringify(failures, null, 1));
