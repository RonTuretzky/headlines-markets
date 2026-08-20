#!/usr/bin/env node
// Test helper: RSA-SHA256 sign a hex-encoded message with the committed dev key and
// print the signature as hex. Used by Foundry tests via vm.ffi so the suite exercises
// REAL RSA signatures (not mocks). Also prints the dev public key on `--pub`.
import { createSign, createPublicKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const keyDir = join(here, "..", "..", "..", "keys");

if (process.argv[2] === "--pub-n" || process.argv[2] === "--pub-e") {
  const jwk = createPublicKey(readFileSync(join(keyDir, "dev-dkim.pub"))).export({ format: "jwk" });
  const part = process.argv[2] === "--pub-n" ? jwk.n : jwk.e;
  process.stdout.write("0x" + Buffer.from(part, "base64url").toString("hex"));
} else {
  const msgHex = process.argv[2].replace(/^0x/, "");
  const sign = createSign("RSA-SHA256");
  sign.update(Buffer.from(msgHex, "hex"));
  const sig = sign.sign(readFileSync(join(keyDir, "dev-dkim.pem")));
  process.stdout.write("0x" + sig.toString("hex"));
}
