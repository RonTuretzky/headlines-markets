// In-browser LLM: plain-English intent → a (usually long) regex in the RegexLib
// onchain subset. No servers: uses Chrome's built-in Prompt API (Gemini Nano)
// when the browser ships one, otherwise WebLLM (Qwen2.5-Coder running on WebGPU,
// weights streamed once and cached by the browser). Every candidate the model
// produces is linted against the onchain subset, compiled with the browser
// RegExp mirror, and tested against the user's example headlines; failures are
// fed back to the model for up to three repair rounds.

export interface AIProgress {
  stage: "detecting" | "downloading" | "loading" | "generating" | "validating";
  pct?: number; // 0..100 (downloads)
  note?: string;
}

export interface AIExample {
  text: string;
  shouldMatch: boolean;
}

export interface AIResult {
  regex: string;
  engine: string;
  attempts: number;
}

interface Engine {
  name: string;
  generate(system: string, user: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Subset validation (mirrors contracts/src/regex/RegexLib.sol)
// ---------------------------------------------------------------------------

const BANNED: Array<[RegExp, string]> = [
  [/\(\?=/, "lookahead (?=…) is not supported onchain"],
  [/\(\?!/, "negative lookahead (?!…) is not supported onchain"],
  [/\(\?</, "lookbehind / named groups are not supported onchain"],
  [/\(\?P/, "named groups are not supported onchain"],
  [/\(\?:/, "non-capturing groups (?:…) are not supported — use plain (…)"],
  [/\\[bB]/, "\\b word boundaries are not supported — use \\s or literal spaces"],
  [/\\[1-9]/, "backreferences are not supported onchain"],
  [/\\p\{/i, "unicode property classes \\p{…} are not supported"],
  [/\\[kK]</, "named backreferences are not supported"],
];

/** Returns an error message when the pattern leaves the RegexLib subset, else null. */
export function lintSubset(pattern: string): string | null {
  if (!pattern.trim()) return "empty pattern";
  const body = pattern.startsWith("(?i)") ? pattern.slice(4) : pattern;
  if (/\(\?/.test(body)) {
    return "only a single leading (?i) flag group is supported — no other (?…) constructs";
  }
  for (const [re, msg] of BANNED) {
    if (re.test(body)) return msg;
  }
  return null;
}

/** Compile with the browser's RegExp — the same mirror the live tester uses. */
export function compileJs(pattern: string): { re: RegExp | null; error: string | null } {
  try {
    let src = pattern;
    let flags = "";
    if (src.startsWith("(?i)")) {
      src = src.slice(4);
      flags = "i";
    }
    return { re: new RegExp(src, flags), error: null };
  } catch (e) {
    return { re: null, error: (e as Error).message };
  }
}

/** Full check: subset lint + compile + example agreement. Null = pattern is good. */
export function validateRegex(pattern: string, examples: AIExample[]): string | null {
  const lint = lintSubset(pattern);
  if (lint) return lint;
  const { re, error } = compileJs(pattern);
  if (!re) return `does not compile: ${error}`;
  for (const ex of examples) {
    const got = re.test(ex.text);
    if (got !== ex.shouldMatch) {
      return `example ${ex.shouldMatch ? "SHOULD match" : "should NOT match"} but ${
        got ? "matched" : "did not match"
      }: “${ex.text}”`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompting
// ---------------------------------------------------------------------------

const SYSTEM = `You translate a plain-English description of a breaking-news condition into ONE
regular expression for an onchain matcher with a restricted syntax.

ALLOWED syntax: literal characters, "." "*" "+" "?" "{m,n}", character classes like [a-z0-9,$],
capturing groups ( ), alternation |, anchors ^ $, the escapes \\d \\w \\s \\. \\$ etc., and an
OPTIONAL single leading "(?i)" for case-insensitive matching (almost always wanted).
FORBIDDEN: lookahead/lookbehind (?= (?! (?<, non-capturing groups (?:, named groups, \\b, \\B,
backreferences, \\p{...}. Any of these makes the answer invalid.

The regex runs over newspaper BREAKING-NEWS EMAIL SUBJECT LINES. Papers word the same story many
ways, so produce a LONG, PERMISSIVE pattern: alternations covering every plausible phrasing,
optional filler between key terms (use .{0,40} style gaps), flexible whitespace (\\s+), optional
words with (word )?. But make sure speculation or negation headlines ("might", "unlikely",
"will he?") do NOT match — anchor on definite verb forms.

Respond with ONLY the regex on a single line inside a fenced code block. No explanation.

Example task: "the Fed cuts interest rates"
\`\`\`
(?i)fed(eral reserve)?\\s+(cuts|lowers|slashes|reduces)\\s+(interest\\s+|benchmark\\s+)?rates?
\`\`\`

Example task: "Bitcoin crosses 200k dollars"
\`\`\`
(?i)(bitcoin|btc).{0,60}(\\$\\s?200[,.]?000|\\$\\s?200k|200[,.]?000\\s+dollars)
\`\`\``;

function userPrompt(intent: string, examples: AIExample[], feedback: string[]): string {
  const ex = examples.length
    ? `\n\nIt must agree with these examples:\n${examples
        .map((e) => `- ${e.shouldMatch ? "MATCH" : "NO MATCH"}: ${e.text}`)
        .join("\n")}`
    : "";
  const fb = feedback.length
    ? `\n\nYour previous attempts failed validation — fix these problems:\n${feedback
        .map((f, i) => `${i + 1}. ${f}`)
        .join("\n")}`
    : "";
  return `Condition: ${intent}${ex}${fb}`;
}

/** Pull the regex out of a model reply: last fenced block, else last non-empty line. */
export function extractPattern(raw: string): string {
  let candidate = "";
  const fenced = [...raw.matchAll(/```[a-z]*\n?([\s\S]*?)```/g)];
  if (fenced.length) {
    candidate = fenced[fenced.length - 1][1].trim();
  } else {
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    candidate = lines[lines.length - 1] ?? "";
  }
  candidate = candidate.split("\n").pop()?.trim() ?? "";
  // strip /slashes/i notation
  const slashed = /^\/(.*)\/([a-z]*)$/.exec(candidate);
  if (slashed) {
    candidate = slashed[1];
    if (slashed[2].includes("i") && !candidate.startsWith("(?i)")) candidate = `(?i)${candidate}`;
  }
  // strip stray backticks/quotes
  return candidate.replace(/^[`"']+|[`"']+$/g, "");
}

// ---------------------------------------------------------------------------
// Engines
// ---------------------------------------------------------------------------

type PromptApi = {
  availability(): Promise<string>;
  create(opts?: unknown): Promise<{ prompt(text: string): Promise<string>; destroy?(): void }>;
};

async function chromePromptEngine(onProgress: (p: AIProgress) => void): Promise<Engine | null> {
  const LM = (globalThis as { LanguageModel?: PromptApi }).LanguageModel;
  if (!LM?.availability || !LM.create) return null;
  try {
    const avail = await LM.availability();
    if (avail === "unavailable") return null;
    onProgress({ stage: "loading", note: "Chrome built-in model (Gemini Nano)" });
    const session = await LM.create({
      monitor(m: EventTarget) {
        m.addEventListener("downloadprogress", (e) => {
          const loaded = (e as unknown as { loaded?: number }).loaded ?? 0;
          onProgress({ stage: "downloading", pct: Math.round(loaded * 100), note: "Chrome built-in model" });
        });
      },
    });
    return {
      name: "Chrome built-in (Gemini Nano)",
      // Prompt API sessions have no separate system slot in the simple call — prepend it.
      generate: async (system, user) => session.prompt(`${system}\n\n${user}`),
    };
  } catch {
    return null;
  }
}

// Streamed once, then cached by the browser (Cache API). ~0.9-1.6 GB of weights.
const WEBLLM_MODELS = [
  "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", // ~1.6 GB VRAM — best regex quality
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC", // ~0.9 GB VRAM — low-resource fallback
];

let webllmEnginePromise: Promise<Engine> | null = null;

async function webllmEngine(onProgress: (p: AIProgress) => void): Promise<Engine> {
  if (webllmEnginePromise) return webllmEnginePromise;
  webllmEnginePromise = (async () => {
    if (!("gpu" in navigator)) {
      throw new Error(
        "This browser has neither a built-in AI model nor WebGPU. Use a recent Chrome/Edge (WebGPU), or write the pattern in Plain-words/Advanced mode.",
      );
    }
    onProgress({ stage: "loading", note: "starting WebLLM" });
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    let lastError: Error | null = null;
    for (const model of WEBLLM_MODELS) {
      try {
        const engine = await CreateMLCEngine(model, {
          initProgressCallback: (r: { progress: number; text: string }) =>
            onProgress({
              stage: r.progress < 1 ? "downloading" : "loading",
              pct: Math.round(r.progress * 100),
              note: `${model.split("-q4")[0]} — ${r.text.slice(0, 80)}`,
            }),
        });
        return {
          name: model.replace("-MLC", ""),
          generate: async (system, user) => {
            const out = await engine.chat.completions.create({
              messages: [
                { role: "system", content: system },
                { role: "user", content: user },
              ],
              temperature: 0.2,
              max_tokens: 400,
            });
            return out.choices[0]?.message?.content ?? "";
          },
        };
      } catch (e) {
        lastError = e as Error;
      }
    }
    throw new Error(`WebLLM could not load a model: ${lastError?.message ?? "unknown error"}`);
  })();
  webllmEnginePromise.catch(() => {
    webllmEnginePromise = null; // allow retry after failure
  });
  return webllmEnginePromise;
}

// ---------------------------------------------------------------------------
// Generation loop
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;

export async function generateRegex(
  intent: string,
  examples: AIExample[],
  onProgress: (p: AIProgress) => void,
): Promise<AIResult> {
  onProgress({ stage: "detecting" });
  const engine = (await chromePromptEngine(onProgress)) ?? (await webllmEngine(onProgress));

  const feedback: string[] = [];
  let lastPattern = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress({ stage: "generating", note: `${engine.name} — attempt ${attempt}/${MAX_ATTEMPTS}` });
    const raw = await engine.generate(SYSTEM, userPrompt(intent, examples, feedback));
    const pattern = extractPattern(raw);
    lastPattern = pattern;
    onProgress({ stage: "validating", note: pattern });
    const problem = validateRegex(pattern, examples);
    if (!problem) return { regex: pattern, engine: engine.name, attempts: attempt };
    feedback.push(`"${pattern}" → ${problem}`);
  }
  throw new Error(
    `The model couldn't produce a valid pattern after ${MAX_ATTEMPTS} attempts (last: "${lastPattern}" — ${feedback.at(-1)?.split("→ ").pop()}). Add example headlines or refine the description.`,
  );
}
