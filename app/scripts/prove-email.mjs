#!/usr/bin/env node
// CLI mock zkEmail prover:  node scripts/prove-email.mjs path/to/email.eml
// Prints the EmailProof struct as JSON (fields ordered as the Solidity struct),
// ready to paste into cast or submit via the frontend.
//
// Uses the same prover module as the frontend (app/src/lib/prover.ts).
import { readFileSync } from "node:fs";
import { proveEml } from "../src/lib/prover.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/prove-email.mjs <email.eml>");
  process.exit(1);
}

const proof = proveEml(readFileSync(path, "utf8"));
console.log(
  JSON.stringify(proof, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
);
