#!/usr/bin/env node
// Launch check against a live site, without JavaScript: `pnpm launch:check https://mysite.com`.
// Fetches the pages search engines and AI crawlers read first and checks status codes,
// redirects, robots.txt, the sitemap, llms.txt, the IndexNow key file and the home page's
// <head>, structured data and links, and that the support address has MX records (DNS over
// HTTPS). Prints a pass/fail table and exits 1 on any failure.
//   INDEXNOW_KEY=<key> pnpm launch:check https://mysite.com   also checks /<key>.txt
//   SUPPORT_EMAIL=<address> pnpm launch:check …               checks that address's domain
// The support address is site.generated.json's when its domain is the checked site, else
// support@<domain>.
// Against localhost the http:// and www. redirects are skipped (they need the real domain).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { domainToASCII, fileURLToPath } from "node:url";
import { PLACEHOLDERS } from "./lib/placeholders.mjs";
import { TEMPLATE_BRAND_ASSETS, sha256Of } from "./lib/template-defaults.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE_FILE = "packages/app-config/src/site.generated.json";
export const DNS_OVER_HTTPS = "https://cloudflare-dns.com/dns-query";

/** AI search and training crawlers robots.txt should name (apps/web/src/routes/robots[.]txt.ts). */
export const AI_CRAWLERS = [
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
  "GPTBot",
  "Google-Extended",
];

/** Locale prefixes that are not served and must 301 to the English page. */
export const RETIRED_LOCALES = ["zh", "jp"];

/** Placeholder kinds that must not reach a live page (labels from lib/placeholders.mjs). */
const PAGE_PLACEHOLDER_LABELS = ["example.com domain", "PLACEHOLDER price/key", "YourBrand name"];

/** The base URL as an origin ("https://mysite.com"), or throws on anything else. */
export function normalizeBase(input) {
  if (!input) throw new Error("usage: pnpm launch:check <https://your-domain>");
  const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`pass the site's origin only, e.g. ${url.origin}`);
  }
  return url.origin;
}

/** localhost, 127.x, [::1] and other hosts without a public domain to redirect from. */
export function isLocalBase(origin) {
  const { hostname } = new URL(origin);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^127\./.test(hostname) ||
    hostname === "[::1]" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

/** Whether a redirect's Location points at `expectedOrigin` (any path on it). */
export function redirectsTo(location, expectedOrigin, from) {
  if (!location) return false;
  try {
    return new URL(location, from).origin === expectedOrigin;
  } catch {
    return false;
  }
}

/** /zh and /jp (turned-off locales) must 301 to the same site's home page. */
export function isHomeRedirect(status, location, from, expectedOrigin) {
  if (status !== 301 || !redirectsTo(location, expectedOrigin, from)) return false;
  return new URL(location, from).pathname === "/";
}

/** Crawlers from AI_CRAWLERS that robots.txt never names in a User-agent line. */
export function missingCrawlers(robots) {
  const agents = new Set(
    [...robots.matchAll(/^\s*user-agent\s*:\s*(\S+)/gim)].map(([, agent]) => agent.toLowerCase()),
  );
  return AI_CRAWLERS.filter((agent) => !agents.has(agent.toLowerCase()));
}

export function hasSitemapLine(robots) {
  return /^\s*sitemap\s*:\s*\S+/im.test(robots);
}

const decodeXml = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * A light sitemap parse: the root must be <urlset> or <sitemapindex> and closed, every <url> or
 * <sitemap> entry needs a <loc>. Returns { ok, error?, kind, locs, lastmods }.
 */
export function parseSitemap(xml) {
  const body = xml
    .replace(/^﻿/, "")
    .replace(/<\?xml[^>]*\?>/, "")
    .trim();
  const root = /^<(urlset|sitemapindex)\b[^>]*>([\s\S]*)<\/\1>\s*$/.exec(body);
  if (!root) {
    return { ok: false, error: "root element is not a closed <urlset> or <sitemapindex>" };
  }
  const kind = root[1];
  const entryTag = kind === "urlset" ? "url" : "sitemap";
  const entries = [...root[2].matchAll(new RegExp(`<${entryTag}>([\\s\\S]*?)</${entryTag}>`, "g"))];
  const opened = (root[2].match(new RegExp(`<${entryTag}>`, "g")) ?? []).length;
  if (opened !== entries.length) return { ok: false, error: `unclosed <${entryTag}> entry` };
  const locs = [];
  const lastmods = [];
  for (const [, entry] of entries) {
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(entry)?.[1]?.trim();
    if (!loc) return { ok: false, error: `a <${entryTag}> has no <loc>` };
    locs.push(decodeXml(loc));
    const lastmod = /<lastmod>([\s\S]*?)<\/lastmod>/.exec(entry)?.[1]?.trim();
    if (lastmod) lastmods.push(lastmod);
  }
  if (locs.length === 0) return { ok: false, error: "no entries" };
  return { ok: true, kind, locs, lastmods };
}

/** True when every <lastmod> is `today` (YYYY-MM-DD): dates are stamped at build, not real. */
export function lastmodsAllToday(lastmods, today) {
  return lastmods.length > 0 && lastmods.every((value) => value.slice(0, 10) === today);
}

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

export function countH1(html) {
  return (stripComments(html).match(/<h1[\s>]/gi) ?? []).length;
}

export function pageTitle(html) {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
}

const attr = (tag, name) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(tag)
    ?.slice(1)
    .find((value) => value !== undefined) ?? null;

/** href of <link rel="canonical">, or null. */
export function canonicalHref(html) {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if ((attr(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")) {
      return attr(tag, "href");
    }
  }
  return null;
}

/** content of <meta property="og:image">, or null. */
export function ogImageUrl(html) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((attr(tag, "property") ?? attr(tag, "name")) === "og:image") return attr(tag, "content");
  }
  return null;
}

/**
 * The served files (`[{ url, bytes }]`) that are byte-for-byte the template's own brand files:
 * the logo, favicon, share image and app icons were never replaced.
 */
export function templateBrandFiles(served) {
  const known = TEMPLATE_BRAND_ASSETS.flatMap(({ path, sha256 }) =>
    sha256.map((hash) => ({ hash, path })),
  );
  return served.flatMap(({ url, bytes }) => {
    const name = new URL(url, "https://x.invalid").pathname;
    const match = known.find(({ hash, path }) => hash === sha256Of(bytes, path));
    return match ? [name] : [];
  });
}

/** Every <script type="application/ld+json"> block, parsed: [{ ok, types?, error? }]. */
export function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => /type\s*=\s*["']?application\/ld\+json/i.test(attrs))
    .map(([, , body]) => {
      try {
        const data = JSON.parse(body);
        const nodes = Array.isArray(data) ? data : (data["@graph"] ?? [data]);
        return { ok: true, types: nodes.map((node) => node?.["@type"]).filter(Boolean) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });
}

/**
 * Distinct same-origin pages the HTML links to (path + search), leaving out the page itself,
 * fragments on it, /api/ and non-http links.
 */
export function internalLinks(html, pageUrl) {
  const page = new URL(pageUrl);
  const links = new Set();
  for (const [tag] of stripComments(html).matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#")) continue;
    let url;
    try {
      url = new URL(href.replace(/&amp;/g, "&"), page);
    } catch {
      continue;
    }
    if (url.origin !== page.origin || url.pathname.startsWith("/api/")) continue;
    if (url.pathname === page.pathname && url.search === page.search) continue;
    links.add(`${url.pathname}${url.search}`);
  }
  return [...links].sort();
}

/** Template guides the page links to (/blog/how-to-make-…). */
export function guideLinks(links) {
  return links.filter((path) => /^\/blog\/how-to-make-[^/?#]+$/.test(path));
}

/** [label, count] for placeholders that must not ship (example.com, PLACEHOLDER, YourBrand). */
export function pagePlaceholders(html) {
  const hits = [];
  for (const { label, pattern } of PLACEHOLDERS) {
    if (!PAGE_PLACEHOLDER_LABELS.includes(label)) continue;
    const count = html.match(pattern)?.length ?? 0;
    if (count) hits.push([label, count]);
  }
  return hits;
}

/** site.generated.json (name, domain, supportEmail, …), or null when it can't be read. */
export function readSiteInfo(root = ROOT) {
  try {
    return JSON.parse(readFileSync(resolve(root, SITE_FILE), "utf8"));
  } catch {
    return null;
  }
}

/**
 * The checked site's support address: `override` (SUPPORT_EMAIL) when given, site.generated.json's
 * supportEmail when its domain is the checked site's, else support@<domain> (www. dropped).
 */
export function resolveSupportEmail(origin, { site, override } = {}) {
  if (override) return override;
  const domain = new URL(origin).hostname.replace(/^www\./, "");
  if (site?.domain === domain && site.supportEmail) return site.supportEmail;
  return `support@${domain}`;
}

/** Reserved and template domains that never receive mail (example.com, *.test, …). */
export function isExampleDomain(domain) {
  return (
    /(?:^|\.)example\.(?:com|net|org)$/.test(domain) ||
    /(?:^|\.)(?:example|test|invalid|localhost)$/.test(domain)
  );
}

/**
 * MX records from a DNS-over-HTTPS JSON answer, by priority: { status, records: [{ priority,
 * exchange }] }. A null MX ("0 .", RFC 7505) has exchange "".
 */
export function parseMxAnswer(body) {
  const records = (body?.Answer ?? [])
    .filter((answer) => answer?.type === 15)
    .map((answer) => {
      const [priority, exchange = ""] = String(answer.data ?? "")
        .trim()
        .split(/\s+/);
      return { priority: Number(priority), exchange: exchange.replace(/\.$/, "") };
    })
    .sort((a, b) => a.priority - b.priority);
  return { status: body?.Status, records };
}

/** MX lookup over DNS-over-HTTPS (Cloudflare's resolver); `fetchImpl` is injectable for tests. */
export async function lookupMx(domain, fetchImpl = fetch) {
  const response = await fetchImpl(`${DNS_OVER_HTTPS}?name=${encodeURIComponent(domain)}&type=MX`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`DNS-over-HTTPS lookup: status ${response.status}`);
  return parseMxAnswer(await response.json());
}

const MAIL_FIX =
  "forward it to the team inbox with Cloudflare Email Routing (launch checklist A10), then send it a real test mail (E14)";

/**
 * [status, detail] for "the support address can receive mail": its domain has MX records.
 * Skipped for local bases and example domains.
 */
export async function supportInboxCheck(origin, supportEmail, fetchImpl = fetch) {
  if (isLocalBase(origin)) return ["SKIP", "local base URL"];
  const written = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(supportEmail ?? "")?.[1];
  // Punycode for DNS (münchen.de → xn--mnchen-3ya.de); "" when the name is not a valid domain.
  const domain = written && domainToASCII(written);
  if (!domain) return ["FAIL", `support address "${supportEmail}" is not an email address`];
  if (isExampleDomain(domain)) return ["SKIP", `${supportEmail} is an example domain`];
  const { status, records } = await lookupMx(domain, fetchImpl);
  if (status === 3) {
    return ["FAIL", `${domain} does not exist in DNS (NXDOMAIN): mail to ${supportEmail} bounces`];
  }
  if (status !== 0) return ["FAIL", `MX lookup for ${domain} failed (DNS status ${status})`];
  const exchanges = records.filter((record) => record.exchange);
  if (exchanges.length === 0) {
    const why = records.length ? "a null MX (accepts no mail)" : "no MX records";
    return ["FAIL", `${domain} has ${why}: mail to ${supportEmail} bounces; ${MAIL_FIX}`];
  }
  const more = exchanges.length > 1 ? ` (+${exchanges.length - 1})` : "";
  return [
    "PASS",
    `${supportEmail} → ${exchanges[0].exchange}${more}; send a real test mail before launch (E14)`,
  ];
}

export function isNoindex(headerValue) {
  return /\bnoindex\b/i.test(headerValue ?? "");
}

/** The report as an aligned text table. */
export function formatTable(results) {
  const rows = [["Check", "Result", "Detail"], ...results.map((r) => [r.name, r.status, r.detail])];
  const widths = [0, 1].map((col) => Math.max(...rows.map((row) => row[col].length)));
  const line = (row) => `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2]}`;
  return [line(rows[0]), `${"-".repeat(widths[0])}  ${"-".repeat(widths[1])}  ------`]
    .concat(rows.slice(1).map(line))
    .join("\n");
}

async function getBytes(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "launch-check (+no-js)" },
    signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
}

async function get(url) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "launch-check (+no-js)" },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

export async function runChecks(
  origin,
  {
    indexNowKey,
    today = new Date().toISOString().slice(0, 10),
    supportEmail = resolveSupportEmail(origin, { site: readSiteInfo() }),
    fetchDns = fetch,
  } = {},
) {
  const results = [];
  const record = (name, status, detail = "") => results.push({ name, status, detail });
  const check = async (name, fn) => {
    try {
      const outcome = await fn();
      if (outcome) record(name, outcome[0], outcome[1] ?? "");
    } catch (error) {
      record(name, "FAIL", error.cause?.code ?? error.message);
    }
  };
  const local = isLocalBase(origin);
  let home;

  await check("home 200", async () => {
    home = await get(`${origin}/`);
    return home.status === 200 ? ["PASS", "200"] : ["FAIL", `status ${home.status}`];
  });

  const host = new URL(origin).host;
  for (const [name, from] of [
    ["http:// 301 to https apex", `http://${host}/`],
    ["www. 301 to https apex", `https://www.${host}/`],
  ]) {
    if (local || !origin.startsWith("https://")) {
      record(name, "SKIP", local ? "local base URL" : "base is not https");
      continue;
    }
    await check(name, async () => {
      const response = await get(from);
      const location = response.headers.get("location");
      return response.status === 301 && redirectsTo(location, origin, from)
        ? ["PASS", `${from} → ${location}`]
        : ["FAIL", `${from}: status ${response.status}, location ${location ?? "none"}`];
    });
  }

  for (const locale of RETIRED_LOCALES) {
    await check(`/${locale} 301`, async () => {
      const from = `${origin}/${locale}`;
      const response = await get(from);
      const location = response.headers.get("location");
      return isHomeRedirect(response.status, location, from, origin)
        ? ["PASS", `→ ${location}`]
        : [
            "FAIL",
            `status ${response.status}, location ${location ?? "none"} (want 301 to ${origin}/)`,
          ];
    });
  }

  await check("unknown path 404", async () => {
    const path = `/launch-check-${Math.random().toString(36).slice(2, 10)}`;
    const response = await get(`${origin}${path}`);
    return response.status === 404
      ? ["PASS", path]
      : ["FAIL", `${path}: status ${response.status}`];
  });

  await check("robots.txt", async () => {
    const response = await get(`${origin}/robots.txt`);
    if (response.status !== 200) return ["FAIL", `status ${response.status}`];
    const problems = [];
    if (!hasSitemapLine(response.text)) problems.push("no Sitemap: line");
    const missing = missingCrawlers(response.text);
    if (missing.length) problems.push(`does not name ${missing.join(", ")}`);
    return problems.length ? ["FAIL", problems.join("; ")] : ["PASS", "Sitemap + AI crawlers"];
  });

  await check("sitemap.xml", async () => {
    const response = await get(`${origin}/sitemap.xml`);
    if (response.status !== 200) return ["FAIL", `status ${response.status}`];
    const sitemap = parseSitemap(response.text);
    if (!sitemap.ok) return ["FAIL", sitemap.error];
    if (lastmodsAllToday(sitemap.lastmods, today)) {
      // Real on launch day (launchDate and the guide's date are today); otherwise a sign the
      // dates are stamped at build time. Not a failure: re-run on a later day to tell.
      return [
        "SKIP",
        `every <lastmod> is today (${today}): fine on launch day, else re-run tomorrow`,
      ];
    }
    return [
      "PASS",
      `${sitemap.locs.length} ${sitemap.kind === "urlset" ? "URLs" : "sitemaps"}, ${sitemap.lastmods.length} lastmod`,
    ];
  });

  await check("llms.txt", async () => {
    const response = await get(`${origin}/llms.txt`);
    return response.status === 200 ? ["PASS", "200"] : ["FAIL", `status ${response.status}`];
  });

  if (indexNowKey) {
    await check("IndexNow key file", async () => {
      const response = await get(`${origin}/${indexNowKey}.txt`);
      if (response.status !== 200) return ["FAIL", `status ${response.status}`];
      return response.text.trim() === indexNowKey
        ? ["PASS", `/${indexNowKey}.txt`]
        : ["FAIL", "content is not exactly the key"];
    });
  } else {
    record("IndexNow key file", "SKIP", "INDEXNOW_KEY not set");
  }

  await check("support inbox MX", () => supportInboxCheck(origin, supportEmail, fetchDns));

  const homeChecks = [
    "home: one <h1>",
    "home: <title>",
    "home: canonical",
    "home: JSON-LD parses",
    "home: no noindex header",
    "home: no placeholders",
    "home: ≥ 3 internal links",
    "home: guide link 200",
    "brand files replaced",
  ];
  if (!home || home.status !== 200) {
    for (const name of homeChecks) record(name, "FAIL", "home page not loaded");
    return results;
  }
  const html = home.text;

  const h1 = countH1(html);
  record(homeChecks[0], h1 === 1 ? "PASS" : "FAIL", `${h1} found`);
  const title = pageTitle(html);
  record(homeChecks[1], title ? "PASS" : "FAIL", title ? title.slice(0, 60) : "missing");
  const canonical = canonicalHref(html);
  let canonicalOk = false;
  try {
    canonicalOk = Boolean(canonical) && new URL(canonical).origin === origin;
  } catch {}
  record(homeChecks[2], canonicalOk ? "PASS" : "FAIL", canonical ?? "missing");
  const blocks = jsonLdBlocks(html);
  const broken = blocks.filter((block) => !block.ok);
  record(
    homeChecks[3],
    blocks.length > 0 && broken.length === 0 ? "PASS" : "FAIL",
    blocks.length === 0
      ? "no JSON-LD"
      : broken.length
        ? broken.map((block) => block.error).join("; ")
        : `${blocks.length} block(s): ${[...new Set(blocks.flatMap((block) => block.types))].join(", ")}`,
  );
  const robotsHeader = home.headers.get("x-robots-tag");
  record(
    homeChecks[4],
    isNoindex(robotsHeader) ? "FAIL" : "PASS",
    robotsHeader ? `X-Robots-Tag: ${robotsHeader}` : "none",
  );
  const placeholders = pagePlaceholders(html);
  record(
    homeChecks[5],
    placeholders.length ? "FAIL" : "PASS",
    placeholders.length
      ? placeholders.map(([label, count]) => `${label} ×${count}`).join(", ")
      : "none",
  );
  const links = internalLinks(html, `${origin}/`);
  record(
    homeChecks[6],
    links.length >= 3 ? "PASS" : "FAIL",
    `${links.length}: ${links.slice(0, 8).join(" ")}${links.length > 8 ? " …" : ""}`,
  );
  const guides = guideLinks(links);
  if (guides.length === 0) {
    record(homeChecks[7], "SKIP", "no /blog/how-to-make-… link on the home page");
  } else {
    for (const path of guides) {
      await check(homeChecks[7], async () => {
        const response = await get(`${origin}${path}`);
        return response.status === 200
          ? ["PASS", path]
          : ["FAIL", `${path}: status ${response.status}`];
      });
    }
  }
  await check(homeChecks[8], async () => {
    const absolute = (url) => new URL(url, `${origin}/`).href;
    const urls = new Set(TEMPLATE_BRAND_ASSETS.flatMap(({ url }) => (url ? [absolute(url)] : [])));
    const og = ogImageUrl(html);
    if (og) urls.add(absolute(og));
    const served = [];
    for (const url of urls) {
      const response = await getBytes(url);
      if (response.status === 200) served.push({ url, bytes: response.bytes });
    }
    const left = templateBrandFiles(served);
    return left.length
      ? ["FAIL", `still the template's own: ${left.join(" ")} (launch checklist B11)`]
      : ["PASS", `${served.length} checked`];
  });
  return results;
}

async function main() {
  let origin;
  try {
    origin = normalizeBase(process.argv.slice(2).find((arg) => !arg.startsWith("-")));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  console.log(`Launch check for ${origin}\n`);
  const supportEmail = resolveSupportEmail(origin, {
    site: readSiteInfo(),
    override: process.env.SUPPORT_EMAIL?.trim(),
  });
  const results = await runChecks(origin, {
    indexNowKey: process.env.INDEXNOW_KEY?.trim(),
    supportEmail,
  });
  console.log(formatTable(results));
  const failed = results.filter((result) => result.status === "FAIL").length;
  const skipped = results.filter((result) => result.status === "SKIP").length;
  console.log(
    `\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`,
  );
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
