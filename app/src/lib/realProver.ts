// REAL zk-regex prover (backlog A3): generates a Groth16 proof with snarkjs that
// the private email content matches the market's compiled DFA circuit, bound to
// (domain, publicKeyHash, timestamp, nullifier) via the public `binding` signal.
//
// The circuit artifacts (pattern.wasm + pattern.zkey, built by
// scripts/zkregex/build-circuit.mjs) are fetched per pattern pair from
// /circuits/<pairHash>/. If no circuit exists for a pair, callers fall back to the
// mock compiled proof — mirroring ZkEmailVerifierV2's onchain fallback.
import * as snarkjs from "snarkjs";
import { encodeAbiParameters, encodePacked, keccak256, stringToHex, type Hex } from "viem";
import { subsetRegexTest, type CompiledProofStruct, type ParsedEmail, mockKeyHash } from "./prover.ts";

const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export interface CircuitMeta {
  pairHash: Hex;
  fromPatternHash: Hex;
  contentPatternHash: Hex;
  fromRegex: string;
  contentField: number;
  contentRegex: string;
  fromLen: number;
  contentLen: number;
  hasFrom: boolean;
}

export function computePairHash(fromRegex: string, contentField: number, contentRegex: string) {
  const fromPatternHash = keccak256(stringToHex(fromRegex));
  const contentPatternHash = keccak256(encodePacked(["uint8", "string"], [contentField, contentRegex]));
  const pairHash = keccak256(encodePacked(["bytes32", "bytes32"], [fromPatternHash, contentPatternHash]));
  return { fromPatternHash, contentPatternHash, pairHash };
}

/** Fetch circuit metadata for a pattern pair, or null if no circuit was compiled. */
export async function fetchCircuitMeta(
  baseUrl: string,
  fromRegex: string,
  contentField: number,
  contentRegex: string,
): Promise<CircuitMeta | null> {
  const { pairHash } = computePairHash(fromRegex, contentField, contentRegex);
  try {
    const res = await fetch(`${baseUrl}/circuits/${pairHash}/meta.json`);
    if (!res.ok) return null;
    return (await res.json()) as CircuitMeta;
  } catch {
    return null;
  }
}

export function bindingOf(parsed: ParsedEmail): bigint {
  const publicKeyHash = mockKeyHash(parsed.domainName);
  const h = keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "bytes32" }, { type: "uint256" }, { type: "bytes32" }],
      [parsed.domainName, publicKeyHash, BigInt(parsed.timestamp), parsed.nullifier],
    ),
  );
  return BigInt(h) % SNARK_SCALAR_FIELD;
}

function toPaddedBytes(s: string, len: number, label: string): number[] {
  const bytes = [...new TextEncoder().encode(s)];
  if (bytes.includes(0)) throw new Error(`${label} contains a NUL byte`);
  if (bytes.length > len) throw new Error(`${label} longer than the circuit field (${bytes.length} > ${len})`);
  while (bytes.length < len) bytes.push(0);
  return bytes;
}

/** Pick the email text the circuit will scan: the field per market config, windowed
 * around the regex match so long bodies still fit the fixed-size circuit input. */
export function selectContentWindow(parsed: ParsedEmail, meta: CircuitMeta): string {
  const candidates =
    meta.contentField === 0
      ? [parsed.subject]
      : meta.contentField === 1
        ? [parsed.bodyExcerpt]
        : [parsed.subject, parsed.bodyExcerpt];
  let src = meta.contentRegex;
  let flags = "";
  if (src.startsWith("(?i)")) {
    src = src.slice(4);
    flags = "i";
  }
  const re = new RegExp(src, flags);
  for (const text of candidates) {
    const m = re.exec(text);
    if (!m) continue;
    if (text.length <= meta.contentLen) return text;
    // window containing the match
    const start = Math.max(0, Math.min(m.index, text.length - meta.contentLen));
    return text.slice(start, start + meta.contentLen);
  }
  throw new Error("The circuit would produce no proof: the email content does not match the market's pattern");
}

/**
 * Generate a REAL Groth16 zk-regex proof. `wasm`/`zkey` are URLs (browser) or file
 * paths (node) accepted by snarkjs. Returns the CompiledEmailProof struct with
 * `proof` = abi.encode(pA, pB, pC) as ZkEmailVerifierV2 expects.
 */
export async function buildRealCompiledProof(
  parsed: ParsedEmail,
  meta: CircuitMeta,
  wasm: string | Uint8Array,
  zkey: string | Uint8Array,
): Promise<CompiledProofStruct> {
  if (meta.hasFrom && !subsetRegexTest(meta.fromRegex, parsed.fromAddress)) {
    throw new Error("The circuit would produce no proof: the From address does not match the market's pattern");
  }
  const content = selectContentWindow(parsed, meta);
  const binding = bindingOf(parsed);

  const input: Record<string, unknown> = {
    contentIn: toPaddedBytes(content, meta.contentLen, "content"),
    binding: binding.toString(),
  };
  if (meta.hasFrom) input.fromIn = toPaddedBytes(parsed.fromAddress, meta.fromLen, "From address");

  const { proof } = await snarkjs.groth16.fullProve(input, wasm as string, zkey as string);

  // snarkjs G2 coordinates are swapped relative to the Solidity verifier's layout.
  const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const pB: [[bigint, bigint], [bigint, bigint]] = [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
  ];
  const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
  const proofBytes = encodeAbiParameters(
    [{ type: "uint256[2]" }, { type: "uint256[2][2]" }, { type: "uint256[2]" }],
    [pA, pB, pC],
  );

  return {
    domainName: parsed.domainName,
    publicKeyHash: mockKeyHash(parsed.domainName),
    timestamp: BigInt(parsed.timestamp),
    fromPatternHash: meta.fromPatternHash,
    contentPatternHash: meta.contentPatternHash,
    emailNullifier: parsed.nullifier,
    proof: proofBytes,
  };
}
