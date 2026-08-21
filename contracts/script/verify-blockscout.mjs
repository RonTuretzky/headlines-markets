#!/usr/bin/env node
// Verify the Gnosis deployment on Blockscout via the v2 standard-input API.
//   node script/verify-blockscout.mjs   (run from contracts/, after forge build)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BLOCKSCOUT = "https://gnosisscan.io";
const d = JSON.parse(readFileSync("deployments/gnosis.json", "utf8"));
const RPC = "https://rpc.gnosischain.com";

const cast = (...a) => execFileSync("cast", a).toString().trim();
const mktImpl = cast("call", "--rpc-url", RPC, d.factory, "marketImplementation()(address)");
const fpmmImpl = cast("call", "--rpc-url", RPC, d.factory, "fpmmImplementation()(address)");

const targets = [
  { addr: d.conditionalTokens, path: "src/tokens/ConditionalTokens.sol", name: "ConditionalTokens", args: "" },
  { addr: d.dkimRegistry, path: "src/zkemail/DKIMRegistry.sol", name: "DKIMRegistry", args: "" },
  {
    addr: d.verifier,
    path: "src/zkemail/DKIMVerifier.sol",
    name: "DKIMVerifier",
    args: cast("abi-encode", "c(address)", d.dkimRegistry),
  },
  { addr: mktImpl, path: "src/market/HeadlineMarket.sol", name: "HeadlineMarket", args: "" },
  { addr: fpmmImpl, path: "src/market/FPMM.sol", name: "FPMM", args: "" },
  {
    addr: d.factory,
    path: "src/market/MarketFactory.sol",
    name: "MarketFactory",
    args: cast("abi-encode", "c(address,address,address,address)", d.conditionalTokens, d.verifier, mktImpl, fpmmImpl),
  },
];

for (const t of targets) {
  const stdJson = execFileSync("forge", ["verify-contract", "--show-standard-json-input", t.addr, `${t.path}:${t.name}`]).toString();
  const fd = new FormData();
  fd.append("compiler_version", "v0.8.28+commit.7893614a");
  fd.append("license_type", "mit");
  fd.append("contract_name", t.name);
  const args = t.args.replace(/^0x/, "");
  if (args) {
    fd.append("constructor_args", args);
    fd.append("autodetect_constructor_args", "false");
  } else {
    fd.append("autodetect_constructor_args", "true");
  }
  fd.append("files[0]", new Blob([stdJson], { type: "application/json" }), "standard_input.json");
  const r = await fetch(`${BLOCKSCOUT}/api/v2/smart-contracts/${t.addr}/verification/via/standard-input`, {
    method: "POST",
    body: fd,
  });
  console.log(`${t.name} @ ${t.addr}: ${r.status} ${(await r.text()).slice(0, 120)}`);
}

// poll a couple of them for final status
await new Promise((r) => setTimeout(r, 20000));
for (const t of targets) {
  const r = await fetch(`${BLOCKSCOUT}/api/v2/smart-contracts/${t.addr}`);
  const j = await r.json().catch(() => ({}));
  console.log(`${t.name}: verified=${j.is_verified ?? j.is_fully_verified ?? false}`);
}
