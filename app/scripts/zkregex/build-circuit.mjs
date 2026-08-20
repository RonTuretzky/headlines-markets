#!/usr/bin/env node
// Build the real zk-regex circuit for a market pattern pair (backlog A3):
//
//   node scripts/zkregex/build-circuit.mjs \
//     --from "^nytdirect@nytimes\.com$"  \
//     --field 2 --content "(?i)fed (cuts|lowers|slashes) (interest )?rates"
//
// Pipeline: regex -> DFA -> circom -> r1cs/wasm -> Groth16 zkey (local dev ptau,
// NO ceremony — see the trust note in docs/ARCHITECTURE.md) -> Solidity verifier
// (written into contracts/src/generated/) + browser artifacts (app/public/circuits/
// <pairHash>/). Deploy + registry registration happens in register-circuits.mjs.
//
// Anchors (^ $) are stripped from the From pattern for circuit purposes: the DFA
// scans a 0-padded fixed field, and the padding rule already prevents the pattern
// from matching across the value boundary; content anchors are rejected.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, stringToHex, encodePacked } from "viem";
import { regexToDFA } from "./regex-to-dfa.mjs";
import { generateCircom } from "./dfa-to-circom.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..", "..");
const rootDir = join(appDir, "..");
const circuitsDir = join(rootDir, "circuits");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const fromRegex = opt("from", "");
const contentField = Number(opt("field", "2"));
const contentRegex = opt("content");
if (!contentRegex) {
  console.error('usage: build-circuit.mjs [--from "regex"] --field 0|1|2 --content "regex" [--ptau-power 18]');
  process.exit(1);
}

export function patternPairHash(fromRegex_, contentField_, contentRegex_) {
  const fromPatternHash = keccak256(stringToHex(fromRegex_));
  const contentPatternHash = keccak256(encodePacked(["uint8", "string"], [contentField_, contentRegex_]));
  const pairHash = keccak256(encodePacked(["bytes32", "bytes32"], [fromPatternHash, contentPatternHash]));
  return { fromPatternHash, contentPatternHash, pairHash };
}

const { fromPatternHash, contentPatternHash, pairHash } = patternPairHash(fromRegex, contentField, contentRegex);
const tag = pairHash.slice(2, 10);
const outDir = join(circuitsDir, "build", tag);
mkdirSync(outDir, { recursive: true });

console.log(`pattern pair ${pairHash} (tag ${tag})`);
console.log(`  from:    /${fromRegex || "(any)"}/ -> hash ${fromPatternHash}`);
console.log(`  content: field=${contentField} /${contentRegex}/ -> hash ${contentPatternHash}`);

// 1. DFAs. The circuit scans fixed padded fields, so anchors on the From pattern
// (almost always ^...$ for exact addresses) are redundant — strip them.
const strippedFrom = fromRegex.replace(/^\^/, "").replace(/([^\\])\$$/, "$1").replace(/^\$$/, "");
const fromDfa = strippedFrom ? regexToDFA(strippedFrom) : null;
const contentDfa = regexToDFA(contentRegex);
console.log(
  `  DFAs: from=${fromDfa ? fromDfa.numStates : 0} states, content=${contentDfa.numStates} states`,
);

// 2. circom source
const FROM_LEN = 48;
const CONTENT_LEN = 160;
const circomSrc = generateCircom(fromDfa, contentDfa, { fromLen: FROM_LEN, contentLen: CONTENT_LEN });
const circomPath = join(outDir, "pattern.circom");
writeFileSync(circomPath, circomSrc);

// 3. compile (circomlib resolved from app/node_modules)
console.log("compiling circuit…");
execFileSync("circom", [circomPath, "--r1cs", "--wasm", "-o", outDir, "-l", join(appDir, "node_modules")], {
  stdio: "inherit",
});

// 4. dev ptau (generated once, cached). DEV ONLY: single fixed-entropy contribution,
// no ceremony — a production deployment runs a real multi-party ceremony per circuit.
const power = Number(opt("ptau-power", "18"));
const ptau = join(circuitsDir, `pot${power}_final.ptau`);
const snarkjs = join(appDir, "node_modules", ".bin", "snarkjs");
if (!existsSync(ptau)) {
  console.log(`generating dev powers-of-tau (2^${power}) — one-time, a few minutes…`);
  const p0 = join(circuitsDir, `pot${power}_0.ptau`);
  const p1 = join(circuitsDir, `pot${power}_1.ptau`);
  execFileSync(snarkjs, ["powersoftau", "new", "bn128", String(power), p0, "-v"], { stdio: "ignore" });
  execFileSync(snarkjs, ["powersoftau", "contribute", p0, p1, "--name=dev", "-v", "-e=headlines dev entropy"], {
    stdio: "ignore",
  });
  execFileSync(snarkjs, ["powersoftau", "prepare", "phase2", p1, ptau, "-v"], { stdio: "ignore" });
}

// 5. Groth16 setup -> zkey -> vkey + Solidity verifier
console.log("groth16 setup…");
const zkey0 = join(outDir, "pattern_0.zkey");
const zkey = join(outDir, "pattern_final.zkey");
execFileSync(snarkjs, ["groth16", "setup", join(outDir, "pattern.r1cs"), ptau, zkey0], { stdio: "inherit" });
execFileSync(snarkjs, ["zkey", "contribute", zkey0, zkey, "--name=dev", "-e=headlines zkey entropy"], {
  stdio: "ignore",
});
execFileSync(snarkjs, ["zkey", "export", "verificationkey", zkey, join(outDir, "vkey.json")], { stdio: "ignore" });
const verifierSol = join(outDir, "verifier.sol");
execFileSync(snarkjs, ["zkey", "export", "solidityverifier", zkey, verifierSol], { stdio: "ignore" });

// 6. rename the contract per pair (multiple verifiers coexist in the repo) and drop
// it into contracts/src/generated/ for forge to compile
const genDir = join(rootDir, "contracts", "src", "generated");
mkdirSync(genDir, { recursive: true });
const contractName = `ZkRegexVerifier_${tag}`;
const sol = readFileSync(verifierSol, "utf8").replace(/contract Groth16Verifier/g, `contract ${contractName}`);
writeFileSync(join(genDir, `${contractName}.sol`), sol);

// 7. browser proving artifacts
const pubDir = join(appDir, "public", "circuits", pairHash);
mkdirSync(pubDir, { recursive: true });
cpSync(join(outDir, "pattern_js", "pattern.wasm"), join(pubDir, "pattern.wasm"));
cpSync(zkey, join(pubDir, "pattern.zkey"));
cpSync(join(outDir, "vkey.json"), join(pubDir, "vkey.json"));
writeFileSync(
  join(pubDir, "meta.json"),
  JSON.stringify(
    {
      pairHash,
      fromPatternHash,
      contentPatternHash,
      fromRegex,
      contentField,
      contentRegex,
      fromLen: FROM_LEN,
      contentLen: CONTENT_LEN,
      contractName,
      hasFrom: !!fromDfa,
    },
    null,
    2,
  ),
);

// 8. registry manifest used by register-circuits.mjs
const manifestPath = join(circuitsDir, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
manifest[pairHash] = { tag, contractName, fromPatternHash, contentPatternHash, fromRegex, contentField, contentRegex };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const r1csInfo = execFileSync(snarkjs, ["r1cs", "info", join(outDir, "pattern.r1cs")]).toString();
console.log(r1csInfo.split("\n").filter((l) => l.includes("Constraints") || l.includes("Wires")).join("\n"));
console.log(`\ndone: verifier contracts/src/generated/${contractName}.sol · artifacts app/public/circuits/${pairHash}/`);
