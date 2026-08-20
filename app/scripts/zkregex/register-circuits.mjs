#!/usr/bin/env node
// Deploy every built zk-regex Groth16 verifier and register it in the
// ZkRegexVerifierRegistry (write-once per pattern pair):
//
//   node scripts/zkregex/register-circuits.mjs [--rpc http://localhost:8547]
//
// Reads circuits/manifest.json (written by build-circuit.mjs); expects
// `forge build` artifacts for contracts/src/generated/*.sol.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..", "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const RPC = opt("rpc", "http://localhost:8547");

const manifestPath = join(rootDir, "circuits", "manifest.json");
if (!existsSync(manifestPath)) {
  console.log("no circuits/manifest.json — nothing to register");
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const deployment = JSON.parse(readFileSync(join(rootDir, "contracts", "deployments", "local.json"), "utf8"));

console.log("forge build (generated verifiers)…");
execFileSync("forge", ["build", "--quiet"], { cwd: join(rootDir, "contracts"), stdio: "inherit" });

const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [
      { type: "bytes32", name: "fromPatternHash" },
      { type: "bytes32", name: "contentPatternHash" },
      { type: "address", name: "verifier" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifierFor",
    inputs: [
      { type: "bytes32", name: "fromPatternHash" },
      { type: "bytes32", name: "contentPatternHash" },
    ],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
];

const account = privateKeyToAccount(
  // anvil dev key #3 (Carol) — registration is permissionless
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
);
const client = createWalletClient({ account, transport: http(RPC) }).extend(publicActions);

for (const [pairHash, entry] of Object.entries(manifest)) {
  const existing = await client.readContract({
    address: deployment.circuitRegistry,
    abi: REGISTRY_ABI,
    functionName: "verifierFor",
    args: [entry.fromPatternHash, entry.contentPatternHash],
  });
  if (existing !== "0x0000000000000000000000000000000000000000") {
    console.log(`${entry.tag}: already registered at ${existing}`);
    continue;
  }
  const artifact = JSON.parse(
    readFileSync(
      join(rootDir, "contracts", "out", `${entry.contractName}.sol`, `${entry.contractName}.json`),
      "utf8",
    ),
  );
  const hash = await client.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object });
  const rc = await client.waitForTransactionReceipt({ hash });
  const verifierAddr = rc.contractAddress;
  const regHash = await client.writeContract({
    address: deployment.circuitRegistry,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [entry.fromPatternHash, entry.contentPatternHash, verifierAddr],
  });
  await client.waitForTransactionReceipt({ hash: regHash });
  console.log(
    `${entry.tag}: deployed Groth16 verifier ${verifierAddr} + registered for pair ${pairHash.slice(0, 10)}…`,
  );
}
console.log("done");
