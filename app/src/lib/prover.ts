// Real DKIM email prover: parses a raw .eml, canonicalizes the signed headers exactly
// as the sender's mail server did, and packages the real RSA signature into the
// EmailProof the onchain DKIMVerifier checks. Nothing here is mocked — the onchain
// verifier does a genuine RSA-SHA256 check of this signature over these header bytes.
import type { Hex } from "viem";
import { bytesToHex, parseDkimEmail, type ParsedDkim } from "./dkim.ts";

export interface EmailProofStruct {
  domainName: string;
  publicKeyHash: Hex;
  timestamp: bigint;
  fromAddress: string;
  subject: string; // the canonicalized subject value bound by the onchain verifier
  bodyExcerpt: string;
  emailNullifier: Hex;
  header: Hex; // canonicalized signed headers (RSA-signed message)
  signature: Hex; // RSA signature (DKIM b=)
}

export interface ParsedEmail extends ParsedDkim {
  subjectDisplay: string; // decoded subject for the UI
  boundSubject: string; // the exact subject value present in the signed header (bound + matched)
}

export function parseEml(raw: string): ParsedEmail {
  const d = parseDkimEmail(raw);
  // The onchain verifier binds `subject` by requiring it appear verbatim in the
  // RSA-verified header, so the value we match/bind is the canonicalized subject as
  // it sits in the header (ASCII fixtures: identical to the readable subject).
  const headerStr = new TextDecoder("latin1").decode(d.headerBytes);
  const m = /(^|\r\n)subject:([^\r\n]*)/i.exec(headerStr);
  const boundSubject = m ? m[2] : d.subject;
  return { ...d, subjectDisplay: d.subject, boundSubject };
}

/** Build the EmailProof. `publicKeyHash` = keccak256(modulus) of the registered DKIM
 * key that signed this email (the app resolves it from the DKIMRegistry by domain+selector). */
export function buildEmailProof(parsed: ParsedEmail, publicKeyHash: Hex): EmailProofStruct {
  return {
    domainName: parsed.domain,
    publicKeyHash,
    timestamp: BigInt(parsed.timestamp),
    fromAddress: parsed.fromAddress,
    subject: parsed.boundSubject,
    bodyExcerpt: parsed.bodyExcerpt,
    emailNullifier: parsed.nullifier,
    header: bytesToHex(parsed.headerBytes),
    signature: bytesToHex(parsed.signature),
  };
}
