// Node DKIM helper: real relaxed/relaxed DKIM signing with the committed dev key, and
// DNS public-key export. Used to re-sign the sample .eml fixtures with REAL signatures
// and to build the onchain key registry. Not shipped to the browser.
import { createSign, createHash, createPublicKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const keyDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "keys");
const DEV_KEY = () => readFileSync(join(keyDir, "dev-dkim.pem"));

function relaxHeader(name, value) {
  return (
    name.toLowerCase().replace(/\s+$/, "") +
    ":" +
    value.replace(/[ \t]*\r?\n[ \t]*/g, " ").replace(/[ \t]+/g, " ").replace(/^ /, "").replace(/ $/, "")
  );
}

/** Relaxed body canonicalization (RFC 6376 §3.4.4). */
function relaxBody(body) {
  let lines = body.replace(/\r\n/g, "\n").split("\n");
  lines = lines.map((l) => l.replace(/[ \t]+/g, " ").replace(/[ \t]+$/, ""));
  let joined = lines.join("\r\n");
  joined = joined.replace(/(\r\n)+$/, ""); // drop trailing empty lines
  return joined.length ? joined + "\r\n" : "\r\n";
}

/**
 * DKIM-sign a raw .eml with the dev key. Strips any existing DKIM-Signature, signs the
 * given header list + the new DKIM-Signature (relaxed/relaxed), returns the signed .eml.
 */
export function signEml(raw, { domain, selector = "dev2026", headers = ["from", "subject", "date", "to"], time }) {
  const norm = raw.replace(/\r\n/g, "\n");
  const split = norm.indexOf("\n\n");
  const headerBlock = norm.slice(0, split);
  const body = norm.slice(split + 2);

  // fold + drop any existing DKIM-Signature
  const lines = [];
  for (const line of headerBlock.split("\n")) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += "\n" + line;
    else lines.push(line);
  }
  const keptLines = lines.filter((l) => !/^dkim-signature:/i.test(l));
  const parsed = keptLines.map((l) => {
    const i = l.indexOf(":");
    return { name: l.slice(0, i), value: l.slice(i + 1).replace(/^ /, ""), lc: l.slice(0, i).toLowerCase() };
  });

  const bh = createHash("sha256").update(relaxBody(body), "latin1").digest("base64");
  const t = time ?? Math.floor(new Date(parsed.find((h) => h.lc === "date")?.value ?? Date.now()).getTime() / 1000);

  // DKIM-Signature header with b= empty
  const dkimNoB =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domain}; s=${selector}; t=${t}; ` +
    `bh=${bh}; h=${headers.join(":")}; b=`;

  // canonicalize: each h= entry (bottom-most unused) + the DKIM-Signature (b= empty)
  let signed = "";
  const used = new Set();
  for (const hn of headers) {
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (parsed[i].lc === hn.toLowerCase() && !used.has(i)) {
        used.add(i);
        signed += relaxHeader(parsed[i].name, parsed[i].value) + "\r\n";
        break;
      }
    }
  }
  signed += relaxHeader("DKIM-Signature", dkimNoB);

  const sign = createSign("RSA-SHA256");
  sign.update(Buffer.from(signed, "latin1"));
  const b = sign.sign(DEV_KEY()).toString("base64");

  const dkimHeader = `DKIM-Signature: ${dkimNoB.replace(/b=$/, "b=" + b)}`;
  // fold the b= a bit for realism (verifier unfolds anyway)
  const foldedDkim = dkimHeader.replace(/(.{1,74})(\s+|$)/g, "$1\r\n ").replace(/\r\n $/, "");
  const outHeaders = [foldedDkim, ...keptLines.map((l) => l.replace(/\n/g, "\r\n"))].join("\r\n");
  return outHeaders + "\r\n\r\n" + body.replace(/\n/g, "\r\n");
}

export function devPublicKey() {
  const jwk = createPublicKey(readFileSync(join(keyDir, "dev-dkim.pub"))).export({ format: "jwk" });
  return {
    modulus: "0x" + Buffer.from(jwk.n, "base64url").toString("hex"),
    exponent: "0x" + Buffer.from(jwk.e, "base64url").toString("hex"),
  };
}

/** Convert a DNS `p=` base64 SPKI public key to {modulus, exponent} hex. */
export function dnsKeyToHex(pBase64) {
  const jwk = createPublicKey({
    key: Buffer.from(`-----BEGIN PUBLIC KEY-----\n${pBase64}\n-----END PUBLIC KEY-----`),
    format: "pem",
  }).export({ format: "jwk" });
  return {
    modulus: "0x" + Buffer.from(jwk.n, "base64url").toString("hex"),
    exponent: "0x" + Buffer.from(jwk.e, "base64url").toString("hex"),
  };
}
