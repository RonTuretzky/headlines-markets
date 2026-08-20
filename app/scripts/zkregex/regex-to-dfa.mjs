// Regex -> DFA compiler for the RegexLib subset (backlog A3, real zk-regex).
//
// Pipeline: parse (same grammar as contracts/src/lib/RegexLib.sol) -> Thompson NFA
// -> subset-construction DFA over byte-interval classes -> search-semantics
// transform (start-state self-loop; accepting states absorbing).
//
// The DFA is what gets compiled into the circom circuit — identical to how
// zkEmail's zk-regex works. Byte 0 (padding) is special-cased: from any
// non-accepting state it goes to a dead state, so zero-padding can never
// complete a match; accepting states absorb everything, so padding never
// un-matches either. The prover rejects content containing NUL bytes.

const INF = Infinity;
const MAX_EXPANSION = 64; // cap for {m,n} duplication so DFAs stay small

// ---------------------------------------------------------------------------
// Parser (mirrors RegexLib.sol's grammar, incl. its documented restrictions)
// ---------------------------------------------------------------------------

export function parseRegex(pattern) {
  let ci = false;
  let src = pattern;
  if (src.startsWith("(?i)")) {
    ci = true;
    src = src.slice(4);
  }
  const s = { src, pos: 0, depth: 0 };
  const ast = parseAlt(s);
  if (s.pos !== src.length) throw new Error(`Regex: unbalanced ')' at ${s.pos}`);
  return { ast, ci };
}

function parseAlt(s) {
  const branches = [parseSeq(s)];
  while (s.pos < s.src.length && s.src[s.pos] === "|") {
    s.pos++;
    branches.push(parseSeq(s));
  }
  return { type: "alt", branches };
}

function parseSeq(s) {
  const atoms = [];
  while (s.pos < s.src.length && s.src[s.pos] !== "|" && s.src[s.pos] !== ")") {
    atoms.push(parseAtom(s));
  }
  return { type: "seq", atoms };
}

const CLASS_ESCAPES = {
  d: [[0x30, 0x39]],
  D: [[0x00, 0x2f], [0x3a, 0xff]],
  w: [[0x30, 0x39], [0x41, 0x5a], [0x5f, 0x5f], [0x61, 0x7a]],
  W: [[0x00, 0x2f], [0x3a, 0x40], [0x5b, 0x5e], [0x60, 0x60], [0x7b, 0xff]],
  s: [[0x09, 0x0d], [0x20, 0x20]],
  S: [[0x00, 0x08], [0x0e, 0x1f], [0x21, 0xff]],
};
const CONTROL = { n: 0x0a, t: 0x09, r: 0x0d, 0: 0x00 };

function isAlnum(c) {
  return /[0-9A-Za-z]/.test(c);
}

function parseAtom(s) {
  const c = s.src[s.pos];
  let node;
  if (c === "(") {
    s.pos++;
    if (s.src.slice(s.pos, s.pos + 2) === "?:") s.pos += 2;
    else if (s.src[s.pos] === "?") throw new Error("Regex: unsupported group modifier");
    s.depth++;
    if (s.depth > 16) throw new Error("Regex: groups nested too deep");
    node = parseAlt(s);
    s.depth--;
    if (s.src[s.pos] !== ")") throw new Error("Regex: missing ')'");
    s.pos++;
  } else if (c === ".") {
    s.pos++;
    // matches everything except \n and \r (RegexLib semantics)
    node = { type: "class", ranges: [[0x00, 0x09], [0x0b, 0x0c], [0x0e, 0xff]] };
  } else if (c === "[") {
    node = parseClass(s);
  } else if (c === "^" || c === "$") {
    throw new Error(
      "Regex: anchors are not supported in compiled circuits (the DFA already scans the whole field; " +
        "use a pattern without ^/$ or settle via the transparent path)",
    );
  } else if (c === "\\") {
    s.pos++;
    if (s.pos >= s.src.length) throw new Error("Regex: trailing backslash");
    const e = s.src[s.pos];
    s.pos++;
    if (CLASS_ESCAPES[e]) node = { type: "class", ranges: CLASS_ESCAPES[e] };
    else if (e in CONTROL) node = { type: "char", code: CONTROL[e] };
    else if (!isAlnum(e)) node = { type: "char", code: e.charCodeAt(0) };
    else throw new Error(`Regex: unsupported escape \\${e}`);
  } else if (c === "*" || c === "+" || c === "?") {
    throw new Error("Regex: quantifier without target");
  } else {
    s.pos++;
    node = { type: "char", code: c.charCodeAt(0) };
  }
  return parseQuantifier(s, node);
}

function parseQuantifier(s, node) {
  const q = s.src[s.pos];
  if (q === "*") {
    s.pos++;
    return { type: "rep", min: 0, max: INF, node };
  }
  if (q === "+") {
    s.pos++;
    return { type: "rep", min: 1, max: INF, node };
  }
  if (q === "?") {
    s.pos++;
    return { type: "rep", min: 0, max: 1, node };
  }
  if (q === "{") {
    const m = /^\{(\d+)(,(\d*)?)?\}/.exec(s.src.slice(s.pos));
    if (m) {
      const lo = parseInt(m[1], 10);
      const hi = m[3] === undefined ? (m[2] ? INF : lo) : m[3] === "" ? INF : parseInt(m[3], 10);
      if (lo > hi) throw new Error("Regex: bad {m,n} bounds");
      if (hi !== INF && hi > MAX_EXPANSION) throw new Error(`Regex: repetition above ${MAX_EXPANSION} not supported in circuits`);
      if (lo > MAX_EXPANSION) throw new Error(`Regex: repetition above ${MAX_EXPANSION} not supported in circuits`);
      s.pos += m[0].length;
      return { type: "rep", min: lo, max: hi, node };
    }
  }
  return node;
}

function parseClass(s) {
  s.pos++; // '['
  let negated = false;
  if (s.src[s.pos] === "^") {
    negated = true;
    s.pos++;
  }
  const ranges = [];
  let first = true;
  for (;;) {
    if (s.pos >= s.src.length) throw new Error("Regex: unterminated class");
    let c = s.src[s.pos];
    if (c === "]" && !first) {
      s.pos++;
      break;
    }
    first = false;
    let lo;
    if (c === "\\") {
      s.pos++;
      const e = s.src[s.pos];
      s.pos++;
      if (CLASS_ESCAPES[e]) {
        ranges.push(...CLASS_ESCAPES[e]);
        continue;
      }
      if (e in CONTROL) lo = CONTROL[e];
      else if (!isAlnum(e)) lo = e.charCodeAt(0);
      else throw new Error(`Regex: unsupported escape \\${e}`);
    } else {
      lo = c.charCodeAt(0);
      s.pos++;
    }
    // range lo-hi (not if next is a class escape — RegexLib Annex-B behaviour)
    const isRange =
      s.src[s.pos] === "-" &&
      s.src[s.pos + 1] !== "]" &&
      s.pos + 1 < s.src.length &&
      !(s.src[s.pos + 1] === "\\" && CLASS_ESCAPES[s.src[s.pos + 2]]);
    if (isRange) {
      s.pos++;
      let hi;
      if (s.src[s.pos] === "\\") {
        s.pos++;
        const e = s.src[s.pos];
        if (e in CONTROL) hi = CONTROL[e];
        else if (!isAlnum(e)) hi = e.charCodeAt(0);
        else throw new Error(`Regex: unsupported escape \\${e}`);
      } else hi = s.src[s.pos].charCodeAt(0);
      s.pos++;
      if (lo > hi) throw new Error("Regex: bad class range");
      ranges.push([lo, hi]);
    } else {
      ranges.push([lo, lo]);
    }
  }
  if (!negated) return { type: "class", ranges };
  // complement over 0x00-0xFF
  const sorted = normalizeRanges(ranges);
  const out = [];
  let cur = 0;
  for (const [lo, hi] of sorted) {
    if (cur < lo) out.push([cur, lo - 1]);
    cur = Math.max(cur, hi + 1);
  }
  if (cur <= 0xff) out.push([cur, 0xff]);
  return { type: "class", ranges: out };
}

function normalizeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [lo, hi] of sorted) {
    if (out.length && lo <= out[out.length - 1][1] + 1) {
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], hi);
    } else out.push([lo, hi]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Thompson NFA
// ---------------------------------------------------------------------------

function buildNFA(ast, ci) {
  const nfa = { states: 0, eps: [], trans: [] }; // trans: [{from, ranges, to}]
  const newState = () => {
    nfa.eps.push([]);
    return nfa.states++;
  };
  const addEps = (a, b) => nfa.eps[a].push(b);
  const addTrans = (a, ranges, b) => nfa.trans.push({ from: a, ranges: foldCase(ranges, ci), to: b });

  function compile(node) {
    if (node.type === "char") {
      const a = newState();
      const b = newState();
      addTrans(a, [[node.code, node.code]], b);
      return [a, b];
    }
    if (node.type === "class") {
      const a = newState();
      const b = newState();
      addTrans(a, normalizeRanges(node.ranges), b);
      return [a, b];
    }
    if (node.type === "seq") {
      if (node.atoms.length === 0) {
        const a = newState();
        return [a, a];
      }
      let [start, end] = compile(node.atoms[0]);
      for (let i = 1; i < node.atoms.length; i++) {
        const [s2, e2] = compile(node.atoms[i]);
        addEps(end, s2);
        end = e2;
      }
      return [start, end];
    }
    if (node.type === "alt") {
      const a = newState();
      const b = newState();
      for (const br of node.branches) {
        const [s2, e2] = compile(br);
        addEps(a, s2);
        addEps(e2, b);
      }
      return [a, b];
    }
    if (node.type === "rep") {
      const { min, max, node: inner } = node;
      if (max === INF) {
        // min copies then a star
        let start = null;
        let end = null;
        for (let i = 0; i < min; i++) {
          const [s2, e2] = compile(inner);
          if (start === null) start = s2;
          else addEps(end, s2);
          end = e2;
        }
        const a = newState();
        const b = newState();
        const [s2, e2] = compile(inner);
        addEps(a, s2);
        addEps(e2, a); // loop
        addEps(a, b);
        if (start === null) return [a, b];
        addEps(end, a);
        return [start, b];
      }
      // bounded {min,max}: chain of max copies with skip-epsilons after the min-th
      return expandBounded(inner, min, max);
    }
    throw new Error(`unknown node ${node.type}`);
  }

  function expandBounded(inner, min, max) {
    const start = newState();
    let end = start;
    const optionalStarts = [];
    for (let i = 0; i < max; i++) {
      const [s2, e2] = compile(inner);
      addEps(end, s2);
      if (i >= min) optionalStarts.push(end);
      end = e2;
    }
    const final = newState();
    addEps(end, final);
    for (const st of optionalStarts) addEps(st, final); // skip the tail
    if (min === 0) addEps(start, final);
    return [start, final];
  }

  const [start, end] = compile(ast);
  return { ...nfa, start, accept: end };
}

function foldCase(ranges, ci) {
  if (!ci) return normalizeRanges(ranges);
  const out = [...ranges];
  for (const [lo, hi] of ranges) {
    // add the case-swapped image of any letter overlap
    const upLo = Math.max(lo, 0x41), upHi = Math.min(hi, 0x5a);
    if (upLo <= upHi) out.push([upLo + 32, upHi + 32]);
    const loLo = Math.max(lo, 0x61), loHi = Math.min(hi, 0x7a);
    if (loLo <= loHi) out.push([loLo - 32, loHi - 32]);
  }
  return normalizeRanges(out);
}

// ---------------------------------------------------------------------------
// Subset construction -> DFA (search semantics)
// ---------------------------------------------------------------------------

export function regexToDFA(pattern) {
  const { ast, ci } = parseRegex(pattern);
  const nfa = buildNFA(ast, ci);

  // Alphabet partition: split 1..255 at every range boundary (byte 0 = padding, handled separately)
  const cuts = new Set([1, 256]);
  for (const t of nfa.trans) {
    for (const [lo, hi] of t.ranges) {
      cuts.add(Math.max(lo, 1));
      cuts.add(hi + 1);
    }
  }
  const bounds = [...cuts].sort((a, b) => a - b);
  const classes = []; // [lo, hi] intervals covering 1..255
  for (let i = 0; i < bounds.length - 1; i++) {
    if (bounds[i] <= 255) classes.push([bounds[i], Math.min(bounds[i + 1] - 1, 255)]);
  }

  const epsClosure = (set) => {
    const stack = [...set];
    const seen = new Set(set);
    while (stack.length) {
      const s = stack.pop();
      for (const t of nfa.eps[s]) {
        if (t !== null && !seen.has(t)) {
          seen.add(t);
          stack.push(t);
        }
      }
    }
    return seen;
  };

  const startSet = epsClosure([nfa.start]);
  const key = (set) => [...set].sort((a, b) => a - b).join(",");
  const dfaStates = new Map([[key(startSet), 0]]);
  const dfaSets = [startSet];
  const dfaTrans = []; // dfaTrans[state] = array over classes -> next state (or -1 dead)
  const queue = [0];

  while (queue.length) {
    const si = queue.shift();
    const set = dfaSets[si];
    const isAccepting = set.has(nfa.accept);
    const row = [];
    for (const [lo, hi] of classes) {
      if (isAccepting) {
        row.push(si); // accepting states are absorbing (search semantics: once matched, stay matched)
        continue;
      }
      const next = new Set();
      for (const t of nfa.trans) {
        if (!set.has(t.from)) continue;
        if (t.ranges.some(([rlo, rhi]) => rlo <= lo && hi <= rhi)) next.add(t.to);
      }
      // search semantics: a match can also start at this position -> merge fresh start
      for (const s of startSet) next.add(s);
      const closed = epsClosure([...next]);
      const k = key(closed);
      if (!dfaStates.has(k)) {
        dfaStates.set(k, dfaSets.length);
        dfaSets.push(closed);
        queue.push(dfaSets.length - 1);
      }
      row.push(dfaStates.get(k));
    }
    dfaTrans[si] = row;
  }

  const accepting = dfaSets.map((s) => s.has(nfa.accept));
  if (accepting[0]) throw new Error("Regex: pattern matches the empty string — not usable as a market condition");
  return {
    numStates: dfaSets.length,
    classes, // byte intervals (1..255); byte 0 handled as padding
    transitions: dfaTrans, // [state][classIdx] -> state
    accepting,
    start: 0,
  };
}

/** Reference DFA evaluation (search semantics, 0 = padding terminator). */
export function dfaTest(dfa, bytes) {
  let state = dfa.start;
  for (const b of bytes) {
    if (dfa.accepting[state]) return true;
    if (b === 0) return dfa.accepting[state];
    const ci = dfa.classes.findIndex(([lo, hi]) => b >= lo && b <= hi);
    if (ci === -1) return false; // shouldn't happen: classes cover 1..255
    state = dfa.transitions[state][ci];
  }
  return dfa.accepting[state];
}
