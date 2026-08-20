// Mock zkEmail prover: parses a raw RFC-2822 email (.eml) and produces the
// EmailProof struct the contracts expect.
//
// A real zkEmail prover would (1) verify the DKIM RSA signature against the
// domain's DNS key, (2) run the email through a circuit that regex-extracts the
// public fields, and (3) output a Groth16 proof. This mock extracts the same
// public fields and "proves" them with proof = keccak256(abi.encode(PROOF_DOMAIN,
// ...fields)) — exactly what MockZKEmailVerifier.verify recomputes onchain.
import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  stringToHex,
  type Hex,
} from "viem";

export const PROOF_DOMAIN = keccak256(stringToHex("ZKEMAIL_MOCK_PROOF_V1"));

export interface ParsedEmail {
  domainName: string; // DKIM d= tag (fallback: From domain)
  fromAddress: string;
  subject: string;
  bodyExcerpt: string;
  timestamp: number; // Date header as unix seconds
  nullifier: Hex; // keccak of the DKIM b= signature (fallback: whole email)
}

export interface EmailProofStruct {
  domainName: string;
  publicKeyHash: Hex;
  timestamp: bigint;
  fromAddress: string;
  subject: string;
  bodyExcerpt: string;
  emailNullifier: Hex;
  proof: Hex;
}

export const COMPILED_PROOF_DOMAIN = keccak256(stringToHex("ZKEMAIL_MOCK_COMPILED_PROOF_V1"));

/** Public outputs of a COMPILED zk-regex proof: pattern commitments, no email content. */
export interface CompiledProofStruct {
  domainName: string;
  publicKeyHash: Hex;
  timestamp: bigint;
  fromPatternHash: Hex;
  contentPatternHash: Hex;
  emailNullifier: Hex;
  proof: Hex;
}

const BODY_EXCERPT_MAX = 4096; // like zkEmail's bounded body bytes

export function parseEml(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const splitAt = normalized.indexOf("\n\n");
  const headerBlock = splitAt === -1 ? normalized : normalized.slice(0, splitAt);
  let body = splitAt === -1 ? "" : normalized.slice(splitAt + 2);

  // Unfold headers (continuation lines start with whitespace).
  const lines: string[] = [];
  for (const line of headerBlock.split("\n")) {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += " " + line.trim();
    } else {
      lines.push(line);
    }
  }
  const headers = new Map<string, string>();
  const dkimHeaders: string[] = []; // an email can carry several DKIM-Signature headers
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "dkim-signature") dkimHeaders.push(value);
    if (!headers.has(key)) headers.set(key, value);
  }

  const fromHeader = headers.get("from") ?? "";
  const fromMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([^\s<>"]+@[^\s<>"]+)/);
  const fromAddress = (fromMatch?.[1] ?? "").trim();
  if (!fromAddress) throw new Error("Could not find a From address in the email");
  const fromDomain = fromAddress.split("@")[1] ?? "";

  const subject = decodeMimeWords(headers.get("subject") ?? "");

  const dateHeader = headers.get("date") ?? "";
  const timestamp = Math.floor(new Date(dateHeader).getTime() / 1000);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error(`Could not parse the Date header: "${dateHeader}"`);
  }

  // Pick the DKIM signature whose d= aligns with the From domain (exact or org-domain
  // suffix, per relaxed DMARC alignment) — real alerts often carry an ESP signature
  // first and the publisher's aligned signature second. Fall back to the first sig,
  // then to the From domain.
  const dkimSigs = dkimHeaders.map((h) => ({
    d: h.match(/(?:^|;)\s*d=([^;\s]+)/)?.[1] ?? "",
    b: h.match(/(?:^|;)\s*b=([^;]+)/)?.[1]?.replace(/\s+/g, "") ?? "",
  }));
  const aligned =
    dkimSigs.find((s) => s.d && (s.d === fromDomain || fromDomain.endsWith("." + s.d))) ??
    dkimSigs.find((s) => s.d) ??
    null;
  const domainName = aligned?.d || fromDomain;
  if (!domainName) throw new Error("Could not determine the DKIM signing domain");

  // Nullifier: prefer the DKIM signature bytes (stable across resends); otherwise hash
  // the CRLF-normalized raw text so re-saving the file with different line endings
  // doesn't change it.
  const bTag = aligned?.b ?? "";
  const nullifier = keccak256(stringToHex(bTag.length > 0 ? `dkim-sig:${bTag}` : `raw-email:${normalized}`));

  // Body: decode quoted-printable only when the email declares that encoding; decoding
  // an unencoded body would corrupt literal '=' characters.
  const cte = (headers.get("content-transfer-encoding") ?? "").toLowerCase();
  if (cte.includes("quoted-printable")) {
    body = decodeQuotedPrintable(body);
  }
  const bodyExcerpt = body.slice(0, BODY_EXCERPT_MAX);

  return { domainName, fromAddress, subject, bodyExcerpt, timestamp, nullifier };
}

/** Decode a quoted-printable body: soft line breaks + `=XX` bytes, UTF-8 aware. */
function decodeQuotedPrintable(s: string): string {
  const withoutSoftBreaks = s.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    const ch = withoutSoftBreaks[i];
    if (ch === "=" && /[0-9A-Fa-f]{2}/.test(withoutSoftBreaks.slice(i + 1, i + 3))) {
      bytes.push(parseInt(withoutSoftBreaks.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      for (const b of new TextEncoder().encode(ch)) bytes.push(b);
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/** Matches MockDKIMRegistry.mockKeyHash(domain). */
export function mockKeyHash(domainName: string): Hex {
  return keccak256(encodePacked(["string", "string"], ["MOCK_DKIM_KEY:", domainName]));
}

/** Builds the EmailProof struct with the mock proof bytes. */
export function buildProof(parsed: ParsedEmail): EmailProofStruct {
  const publicKeyHash = mockKeyHash(parsed.domainName);
  const proof = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "string" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "bytes32" },
      ],
      [
        PROOF_DOMAIN,
        parsed.domainName,
        publicKeyHash,
        BigInt(parsed.timestamp),
        parsed.fromAddress,
        parsed.subject,
        parsed.bodyExcerpt,
        parsed.nullifier,
      ],
    ),
  );
  return {
    domainName: parsed.domainName,
    publicKeyHash,
    timestamp: BigInt(parsed.timestamp),
    fromAddress: parsed.fromAddress,
    subject: parsed.subject,
    bodyExcerpt: parsed.bodyExcerpt,
    emailNullifier: parsed.nullifier,
    proof,
  };
}

export function proveEml(raw: string): EmailProofStruct {
  return buildProof(parseEml(raw));
}

/** JS mirror of the onchain regex subset ((?i) prefix -> i flag), used to evaluate
 * the "circuit" locally. Differential-tested against RegexLib in Foundry. */
export function subsetRegexTest(pattern: string, input: string): boolean {
  let src = pattern;
  let flags = "";
  if (src.startsWith("(?i)")) {
    src = src.slice(4);
    flags = "i";
  }
  return new RegExp(src, flags).test(input);
}

/**
 * Build a COMPILED zk-regex proof (backlog E1/A3): the patterns are compiled into
 * the circuit, which only produces a proof when the email matches them — so this
 * mock evaluates the patterns locally and refuses to "prove" a non-matching email.
 * Onchain, only the pattern commitments appear; the subject/body never leave the
 * prover. contentField: 0 = Subject, 1 = Body, 2 = SubjectOrBody.
 */
export function buildCompiledProof(
  parsed: ParsedEmail,
  opts: { fromRegex: string; contentField: number; contentPattern: string },
): CompiledProofStruct {
  if (opts.fromRegex && !subsetRegexTest(opts.fromRegex, parsed.fromAddress)) {
    throw new Error("The circuit would produce no proof: the From address does not match the market's pattern");
  }
  const contentOk =
    opts.contentPattern.length === 0 ||
    (opts.contentField === 0
      ? subsetRegexTest(opts.contentPattern, parsed.subject)
      : opts.contentField === 1
        ? subsetRegexTest(opts.contentPattern, parsed.bodyExcerpt)
        : subsetRegexTest(opts.contentPattern, parsed.subject) ||
          subsetRegexTest(opts.contentPattern, parsed.bodyExcerpt));
  if (!contentOk) {
    throw new Error("The circuit would produce no proof: the email content does not match the market's pattern");
  }

  const publicKeyHash = mockKeyHash(parsed.domainName);
  const fromPatternHash = keccak256(stringToHex(opts.fromRegex));
  const contentPatternHash = keccak256(
    encodePacked(["uint8", "string"], [opts.contentField, opts.contentPattern]),
  );
  const proof = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "string" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        COMPILED_PROOF_DOMAIN,
        parsed.domainName,
        publicKeyHash,
        BigInt(parsed.timestamp),
        fromPatternHash,
        contentPatternHash,
        parsed.nullifier,
      ],
    ),
  );
  return {
    domainName: parsed.domainName,
    publicKeyHash,
    timestamp: BigInt(parsed.timestamp),
    fromPatternHash,
    contentPatternHash,
    emailNullifier: parsed.nullifier,
    proof,
  };
}

/**
 * RFC 2047 encoded-word decoding (=?charset?Q/B?...?=), charset-aware (UTF-8 is the
 * common case in real alert subjects). Adjacent encoded words separated only by
 * whitespace are concatenated with no separator, per RFC 2047 §6.2.
 */
function decodeMimeWords(s: string): string {
  const collapsed = s.replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?)/g, "$1");
  return collapsed.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, charset: string, enc: string, text: string) => {
    let bytes: number[];
    if (enc.toUpperCase() === "B") {
      try {
        const bin = atobPolyfill(text);
        bytes = Array.from(bin, (c) => c.charCodeAt(0));
      } catch {
        return text;
      }
    } else {
      bytes = [];
      const q = text.replace(/_/g, " ");
      for (let i = 0; i < q.length; i++) {
        if (q[i] === "=" && /[0-9A-Fa-f]{2}/.test(q.slice(i + 1, i + 3))) {
          bytes.push(parseInt(q.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          for (const b of new TextEncoder().encode(q[i])) bytes.push(b);
        }
      }
    }
    try {
      return new TextDecoder(charset.toLowerCase().includes("8859") ? "iso-8859-1" : "utf-8").decode(
        new Uint8Array(bytes),
      );
    } catch {
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    }
  });
}

function atobPolyfill(b64: string): string {
  if (typeof atob === "function") return atob(b64);
  // node fallback without pulling in @types/node
  return (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } }).Buffer!.from(
    b64,
    "base64",
  ).toString("binary");
}
