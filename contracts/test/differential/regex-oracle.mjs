#!/usr/bin/env node
// Differential oracle for RegexLib: evaluates (pattern, input) pairs with JS RegExp
// and prints a hex-encoded result bitstring ("01" per case) for Foundry's ffi.
//
// Cases arrive as base64(JSON [[pattern, input], ...]) in argv[2].
// A leading "(?i)" in the pattern maps to the JS "i" flag (RegexLib convention).
//
// Known intentional divergences from JS (excluded from corpora, documented in
// docs/ARCHITECTURE.md): "[]"-style empty classes (RegexLib treats a leading "]"
// as a literal, POSIX-style), lookaround and backreferences (unsupported).

const cases = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));

let out = "";
for (const [pattern, input] of cases) {
  let source = pattern;
  let flags = "";
  if (source.startsWith("(?i)")) {
    source = source.slice(4);
    flags = "i";
  }
  const re = new RegExp(source, flags);
  out += re.test(input) ? "01" : "00";
}
process.stdout.write("0x" + out);
