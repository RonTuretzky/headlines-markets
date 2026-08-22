#!/usr/bin/env node
// Discover newspapers' public DKIM keys.
//   node scripts/discover-dkim.mjs [--out ../docs/dkim-keys-public.json] [--no-brute]
//
// Sources, in order:
//   1. ZK Email's public DKIM archive (archive.prove.email) — every (domain, selector)
//      observed in real email, with the key value and first/last-seen dates.
//   2. Live DNS — every archived selector is re-checked against DNS right now
//      (`live: true` means the key is currently published and can sign mail today).
//   3. Selector brute-force on live DNS — common ESP selector names (SparkPost
//      scphMMYY, Mailchimp k1-3, SendGrid s1/s2, Google, Microsoft, SES-style
//      fixed names, …) against each outlet's apex + typical mail subdomains, to
//      catch keys the archive has never seen.
// Only RSA keys with a non-empty p= and a modulus >= 1024 bits are kept (the
// DKIMRegistry rejects anything shorter). Output is registry-ready (modulus/exponent hex).
import { resolveTxt } from "node:dns/promises";
import { writeFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";

const args = process.argv.slice(2);
const outPath = args.includes("--out") ? args[args.indexOf("--out") + 1] : "../docs/dkim-keys-public.json";
const BRUTE = !args.includes("--no-brute");

// ----------------------------------------------------------------------------- outlets
// name, region, apex domains (+ known mail subdomains). Subdomain prefixes below are
// tried on every apex automatically.
const OUTLETS = [
  // wires
  ["Reuters", "wire", ["reuters.com", "email.reuters.com"]],
  ["Associated Press", "wire", ["apnews.com", "ap.org"]],
  ["AFP", "wire", ["afp.com"]],
  ["Bloomberg", "wire", ["bloomberg.com", "mail.bloomberg.com"]],
  // US
  ["The New York Times", "US", ["nytimes.com"]],
  ["The Washington Post", "US", ["washingtonpost.com", "email.washingtonpost.com"]],
  ["The Wall Street Journal", "US", ["wsj.com", "dowjones.com"]],
  ["Los Angeles Times", "US", ["latimes.com"]],
  ["USA Today", "US", ["usatoday.com"]],
  ["Chicago Tribune", "US", ["chicagotribune.com"]],
  ["The Boston Globe", "US", ["bostonglobe.com"]],
  ["Politico", "US", ["politico.com", "politico.eu"]],
  ["Axios", "US", ["axios.com"]],
  ["The Hill", "US", ["thehill.com"]],
  ["CNN", "US", ["cnn.com", "mail.cnn.com"]],
  ["CNBC", "US", ["cnbc.com"]],
  ["NBC News", "US", ["nbcnews.com"]],
  ["ABC News", "US", ["abcnews.go.com", "go.com"]],
  ["CBS News", "US", ["cbsnews.com"]],
  ["NPR", "US", ["npr.org"]],
  ["Fox News", "US", ["foxnews.com"]],
  ["The Atlantic", "US", ["theatlantic.com"]],
  ["The New Yorker", "US", ["newyorker.com"]],
  ["Vox", "US", ["vox.com"]],
  ["Semafor", "US", ["semafor.com"]],
  ["The Intercept", "US", ["theintercept.com"]],
  ["Jacobin", "US", ["jacobin.com"]],
  ["The Nation", "US", ["thenation.com"]],
  ["Democracy Now", "US", ["democracynow.org"]],
  ["ProPublica", "US", ["propublica.org"]],
  ["Time", "US", ["time.com"]],
  ["Newsweek", "US", ["newsweek.com"]],
  ["Mother Jones", "US", ["motherjones.com"]],
  ["In These Times", "US", ["inthesetimes.com"]],
  // UK / Europe
  ["The Guardian", "UK", ["theguardian.com", "mail.theguardian.com"]],
  ["BBC", "UK", ["bbc.co.uk", "bbc.com"]],
  ["Financial Times", "UK", ["ft.com"]],
  ["The Times", "UK", ["thetimes.co.uk", "thetimes.com"]],
  ["The Telegraph", "UK", ["telegraph.co.uk"]],
  ["The Independent", "UK", ["independent.co.uk"]],
  ["The Economist", "UK", ["economist.com"]],
  ["Le Monde", "FR", ["lemonde.fr"]],
  ["Le Figaro", "FR", ["lefigaro.fr"]],
  ["Libération", "FR", ["liberation.fr"]],
  ["France 24", "FR", ["france24.com"]],
  ["RFI", "FR", ["rfi.fr"]],
  ["Der Spiegel", "DE", ["spiegel.de"]],
  ["Süddeutsche Zeitung", "DE", ["sueddeutsche.de"]],
  ["FAZ", "DE", ["faz.net"]],
  ["Die Zeit", "DE", ["zeit.de"]],
  ["Deutsche Welle", "DE", ["dw.com"]],
  ["El País", "ES", ["elpais.com"]],
  ["El Mundo", "ES", ["elmundo.es"]],
  ["La Repubblica", "IT", ["repubblica.it"]],
  ["Corriere della Sera", "IT", ["corriere.it"]],
  ["NRC", "NL", ["nrc.nl"]],
  ["De Volkskrant", "NL", ["volkskrant.nl"]],
  ["Euronews", "EU", ["euronews.com"]],
  ["Kyiv Independent", "UA", ["kyivindependent.com"]],
  ["Meduza", "RU/LV", ["meduza.io"]],
  // Middle East / Africa
  ["Al Jazeera", "QA", ["aljazeera.com", "aljazeera.net"]],
  ["Haaretz", "IL", ["haaretz.com"]],
  ["The Times of Israel", "IL", ["timesofisrael.com"]],
  ["Arab News", "SA", ["arabnews.com"]],
  ["The National", "AE", ["thenationalnews.com"]],
  ["Gulf News", "AE", ["gulfnews.com"]],
  ["Al-Ahram", "EG", ["ahram.org.eg", "english.ahram.org.eg"]],
  ["Daily Nation", "KE", ["nation.africa", "nationmedia.com"]],
  ["The Standard", "KE", ["standardmedia.co.ke"]],
  ["Mail & Guardian", "ZA", ["mg.co.za"]],
  ["Daily Maverick", "ZA", ["dailymaverick.co.za"]],
  ["News24", "ZA", ["news24.com"]],
  ["Punch", "NG", ["punchng.com"]],
  ["Premium Times", "NG", ["premiumtimesng.com"]],
  ["The Guardian Nigeria", "NG", ["guardian.ng"]],
  ["Addis Standard", "ET", ["addisstandard.com"]],
  // South Asia
  ["The Times of India", "IN", ["timesofindia.com", "indiatimes.com", "timesofindia.indiatimes.com"]],
  ["The Hindu", "IN", ["thehindu.com"]],
  ["Hindustan Times", "IN", ["hindustantimes.com"]],
  ["The Indian Express", "IN", ["indianexpress.com"]],
  ["NDTV", "IN", ["ndtv.com"]],
  ["Dawn", "PK", ["dawn.com"]],
  ["The Daily Star", "BD", ["thedailystar.net"]],
  // East / Southeast Asia, Pacific
  ["South China Morning Post", "HK", ["scmp.com"]],
  ["The Straits Times", "SG", ["straitstimes.com", "sph.com.sg"]],
  ["The Japan Times", "JP", ["japantimes.co.jp"]],
  ["Nikkei Asia", "JP", ["nikkei.com", "asia.nikkei.com"]],
  ["The Korea Herald", "KR", ["koreaherald.com"]],
  ["The Jakarta Post", "ID", ["thejakartapost.com"]],
  ["Philippine Daily Inquirer", "PH", ["inquirer.net"]],
  ["Rappler", "PH", ["rappler.com"]],
  ["Bangkok Post", "TH", ["bangkokpost.com"]],
  ["ABC Australia", "AU", ["abc.net.au"]],
  ["The Sydney Morning Herald", "AU", ["smh.com.au"]],
  // Americas
  ["The Globe and Mail", "CA", ["theglobeandmail.com"]],
  ["Toronto Star", "CA", ["thestar.com"]],
  ["CBC", "CA", ["cbc.ca"]],
  ["Folha de S.Paulo", "BR", ["folha.uol.com.br", "folha.com.br", "uol.com.br"]],
  ["O Globo", "BR", ["oglobo.globo.com", "globo.com"]],
  ["Estadão", "BR", ["estadao.com.br"]],
  ["Clarín", "AR", ["clarin.com"]],
  ["La Nación", "AR", ["lanacion.com.ar"]],
  ["El Universal", "MX", ["eluniversal.com.mx"]],
  ["Reforma", "MX", ["reforma.com"]],
  ["El Tiempo", "CO", ["eltiempo.com"]],
  ["La Tercera", "CL", ["latercera.com"]],
  ["El Comercio", "PE", ["elcomercio.pe"]],
  ["Rest of World", "global", ["restofworld.org"]],
  ["The Conversation", "global", ["theconversation.com"]],
];

const SUBDOMAIN_PREFIXES = ["email", "mail", "e", "news", "newsletter", "newsletters", "alerts", "alert", "info", "nl", "em", "link", "go", "m", "updates", "notifications", "mailer", "send", "members", "bounce"];

// Common ESP selector names. SparkPost date-stamps selectors as scphMMYY (NYT also
// uses scphYYYYMMDD, which is not enumerable — the archive covers those).
const SELECTORS = (() => {
  const s = new Set([
    "default", "dkim", "mail", "email", "s1", "s2", "s3", "k1", "k2", "k3", "m1", "m2", "google", "selector1", "selector2",
    "smtpapi", "sendgrid", "mandrill", "mailchimp", "mc", "mte1", "mte2", "sailthru", "sm", "sfmc", "s1024", "s2048", "key1", "key2",
    "dkim1", "dkim2", "mailgun", "mg", "mx", "pm", "postmark", "hs1", "hs2", "cm", "ctct1", "ctct2", "kl", "kl2", "braze", "iterable",
    "itbl", "cordial", "emsmtp", "rs1", "rs2", "elq", "adobe", "campaign", "acoustic", "silverpop", "sp", "zeta", "zg", "dk", "dk1",
    "prd", "prod", "mail1", "mail2", "news", "newsletter", "alerts", "amazonses", "ses", "fm1", "fm2", "protonmail", "mesmtp", "pic",
    "20161025", "20210112", "20230601", "20200124", "20150623", "200608", "zendesk1", "zendesk2", "o365", "everlytic", "mailjet",
    "mj", "brevo", "sib", "sendinblue", "exacttarget", "et", "s1-sfmc", "cust1", "sparkpost", "scph",
  ]);
  for (let y = 18; y <= 26; y++) for (let m = 1; m <= 12; m++) s.add(`scph${String(m).padStart(2, "0")}${y}`);
  return [...s];
})();

// ----------------------------------------------------------------------------- helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx]);
        } catch {
          out[idx] = null;
        }
      }
    }),
  );
  return out;
}

function parseDkimTxt(txt) {
  const tags = Object.fromEntries(
    txt
      .split(";")
      .map((kv) => kv.trim())
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf("=");
        return [kv.slice(0, i).trim().toLowerCase(), kv.slice(i + 1).replace(/\s+/g, "")];
      }),
  );
  if (tags.k && tags.k.toLowerCase() !== "rsa") return null;
  if (!tags.p) return null; // revoked key
  try {
    const jwk = createPublicKey({ key: `-----BEGIN PUBLIC KEY-----\n${tags.p}\n-----END PUBLIC KEY-----`, format: "pem" }).export({ format: "jwk" });
    const modulus = Buffer.from(jwk.n, "base64url");
    if (modulus.length < 128) return null;
    return { modulus: "0x" + modulus.toString("hex"), exponent: "0x" + Buffer.from(jwk.e, "base64url").toString("hex"), bits: modulus.length * 8 };
  } catch {
    return null;
  }
}

async function dnsTxt(name) {
  try {
    return (await resolveTxt(name)).map((r) => r.join("")).join("");
  } catch {
    return null;
  }
}

async function archiveKeys(domain) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://archive.prove.email/api/key?domain=${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(20000) });
      if (r.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    } catch {
      await sleep(1000);
    }
  }
  return [];
}

// ----------------------------------------------------------------------------- run
const candidates = [];
for (const [name, region, domains] of OUTLETS) {
  const set = new Set();
  for (const d of domains) {
    set.add(d);
    for (const p of SUBDOMAIN_PREFIXES) set.add(`${p}.${d}`);
  }
  for (const d of set) candidates.push({ outlet: name, region, domain: d });
}
console.error(`${OUTLETS.length} outlets → ${candidates.length} candidate domains`);

// 1. archive
const found = new Map(); // `${domain}|${selector}` -> record
const archiveHits = await pool(candidates, 6, async (c) => {
  const keys = await archiveKeys(c.domain);
  return { c, keys };
});
for (const hit of archiveHits.filter(Boolean)) {
  for (const k of hit.keys) {
    if (k.domain !== hit.c.domain) continue; // exact domain only
    const parsed = parseDkimTxt(k.value ?? "");
    if (!parsed) continue;
    found.set(`${k.domain}|${k.selector}`, {
      outlet: hit.c.outlet,
      region: hit.c.region,
      domain: k.domain,
      selector: k.selector,
      ...parsed,
      source: "archive",
      firstSeen: k.firstSeenAt,
      lastSeen: k.lastSeenAt,
      live: false,
    });
  }
}
console.error(`archive: ${found.size} RSA keys across ${new Set([...found.values()].map((f) => f.domain)).size} domains`);

// 2. live DNS re-check of archived selectors
await pool([...found.values()], 30, async (rec) => {
  const txt = await dnsTxt(`${rec.selector}._domainkey.${rec.domain}`);
  const parsed = txt ? parseDkimTxt(txt) : null;
  if (parsed) {
    rec.live = true;
    if (parsed.modulus !== rec.modulus) {
      // the selector was re-keyed since the archive saw it — the live key is what matters
      Object.assign(rec, parsed, { source: "archive+dns(rekeyed)" });
    }
  }
});

// 3. brute-force selectors on live DNS, for domains that show any mail presence
if (BRUTE) {
  const mailDomains = (
    await pool(candidates, 40, async (c) => {
      const [spf, dmarc] = await Promise.all([dnsTxt(c.domain), dnsTxt(`_dmarc.${c.domain}`)]);
      const hasMail = (spf && /v=spf1/i.test(spf)) || (dmarc && /v=DMARC1/i.test(dmarc)) || [...found.values()].some((f) => f.domain === c.domain);
      return hasMail ? c : null;
    })
  ).filter(Boolean);
  console.error(`brute-force: ${mailDomains.length} domains with SPF/DMARC × ${SELECTORS.length} selectors`);
  const probes = mailDomains.flatMap((c) => SELECTORS.map((s) => ({ c, s })));
  let bruteNew = 0;
  await pool(probes, 60, async ({ c, s }) => {
    const key = `${c.domain}|${s}`;
    if (found.has(key)) return;
    const txt = await dnsTxt(`${s}._domainkey.${c.domain}`);
    if (!txt) return;
    const parsed = parseDkimTxt(txt);
    if (!parsed) return;
    found.set(key, { outlet: c.outlet, region: c.region, domain: c.domain, selector: s, ...parsed, source: "dns-brute", firstSeen: null, lastSeen: null, live: true });
    bruteNew++;
  });
  console.error(`brute-force: +${bruteNew} keys`);
}

const records = [...found.values()].sort((a, b) => a.outlet.localeCompare(b.outlet) || a.domain.localeCompare(b.domain) || a.selector.localeCompare(b.selector));
const live = records.filter((r) => r.live);
const summary = {
  generatedAt: new Date().toISOString(),
  outlets: OUTLETS.length,
  keys: records.length,
  liveKeys: live.length,
  outletsWithLiveKey: new Set(live.map((r) => r.outlet)).size,
  records,
};
writeFileSync(outPath, JSON.stringify(summary, null, 1));
console.error(`wrote ${records.length} keys (${live.length} live, ${summary.outletsWithLiveKey}/${OUTLETS.length} outlets) -> ${outPath}`);
