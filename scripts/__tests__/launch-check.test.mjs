import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalHref,
  countH1,
  formatTable,
  guideLinks,
  hasSitemapLine,
  internalLinks,
  DNS_OVER_HTTPS,
  isExampleDomain,
  isHomeRedirect,
  isLocalBase,
  isNoindex,
  jsonLdBlocks,
  lastmodsAllToday,
  missingCrawlers,
  normalizeBase,
  ogImageUrl,
  pagePlaceholders,
  pageTitle,
  parseMxAnswer,
  parseSitemap,
  redirectsTo,
  resolveSupportEmail,
  supportInboxCheck,
  templateBrandFiles,
} from "../launch-check.mjs";

test("the base URL is reduced to an origin; paths are refused", () => {
  assert.equal(normalizeBase("https://dancebooth.app"), "https://dancebooth.app");
  assert.equal(normalizeBase("https://dancebooth.app/"), "https://dancebooth.app");
  assert.equal(normalizeBase("dancebooth.app"), "https://dancebooth.app");
  assert.equal(normalizeBase("http://localhost:3000"), "http://localhost:3000");
  assert.throws(() => normalizeBase("https://dancebooth.app/pricing"), /origin only/);
  assert.throws(() => normalizeBase(undefined), /usage/);
});

test("local bases skip the domain redirects", () => {
  assert.equal(isLocalBase("http://localhost:3000"), true);
  assert.equal(isLocalBase("http://127.0.0.1:3000"), true);
  assert.equal(isLocalBase("https://dancebooth.app"), false);
});

test("turned-off locales must 301 to the home page of the same site", () => {
  const from = "https://dancebooth.app/zh";
  assert.equal(
    isHomeRedirect(301, "https://dancebooth.app/", from, "https://dancebooth.app"),
    true,
  );
  assert.equal(isHomeRedirect(301, "/", from, "https://dancebooth.app"), true);
  assert.equal(isHomeRedirect(302, "/", from, "https://dancebooth.app"), false);
  assert.equal(isHomeRedirect(301, "/zh/", from, "https://dancebooth.app"), false);
  assert.equal(isHomeRedirect(301, "https://other.app/", from, "https://dancebooth.app"), false);
  assert.equal(isHomeRedirect(301, null, from, "https://dancebooth.app"), false);
});

test("redirect targets are compared by origin", () => {
  const apex = "https://dancebooth.app";
  assert.equal(redirectsTo("https://dancebooth.app/", apex, "http://dancebooth.app/"), true);
  assert.equal(redirectsTo("https://www.dancebooth.app/", apex, "http://dancebooth.app/"), false);
  assert.equal(redirectsTo("/", apex, "https://www.dancebooth.app/"), false);
  assert.equal(redirectsTo(null, apex, "http://dancebooth.app/"), false);
});

test("robots.txt must name every AI crawler and the sitemap", () => {
  const robots = [
    "User-agent: *",
    "Allow: /",
    "User-agent: GPTBot",
    "user-agent: claudebot",
    "Sitemap: https://dancebooth.app/sitemap.xml",
  ].join("\n");
  assert.equal(hasSitemapLine(robots), true);
  assert.deepEqual(missingCrawlers(robots), ["OAI-SearchBot", "PerplexityBot", "Google-Extended"]);
  assert.equal(hasSitemapLine("User-agent: *\nAllow: /"), false);
});

test("sitemaps parse, and stamped-today lastmods are caught", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://dancebooth.app/</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://dancebooth.app/blog?a=1&amp;b=2</loc><lastmod>2026-10-20T00:00:00Z</lastmod></url>
</urlset>`;
  const sitemap = parseSitemap(xml);
  assert.equal(sitemap.ok, true);
  assert.deepEqual(sitemap.locs, [
    "https://dancebooth.app/",
    "https://dancebooth.app/blog?a=1&b=2",
  ]);
  assert.equal(lastmodsAllToday(sitemap.lastmods, "2026-10-20"), false);
  assert.equal(lastmodsAllToday(["2026-10-20", "2026-10-20T08:00:00Z"], "2026-10-20"), true);
  assert.equal(lastmodsAllToday([], "2026-10-20"), false);
  assert.equal(parseSitemap("<html></html>").ok, false);
  assert.match(parseSitemap("<urlset><url><loc>x</loc></url><url></urlset>").error, /unclosed/);
  assert.match(parseSitemap("<urlset><url><lastmod>x</lastmod></url></urlset>").error, /no <loc>/);
  assert.equal(
    parseSitemap("<sitemapindex><sitemap><loc>a</loc></sitemap></sitemapindex>").kind,
    "sitemapindex",
  );
});

const HOME = `<!doctype html><html><head>
<title>Duo Dance | Dance Booth</title>
<link rel="stylesheet" href="/a.css"><link href="https://dancebooth.app/" rel="canonical">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}</script>
<script type="application/ld+json">{"broken":</script>
</head><body><!-- <h1>old</h1> -->
<h1 class="display">Duo Dance</h1>
<a href="/">Home</a><a href="#faq">FAQ</a><a href="/#how-it-works">How</a>
<a href="/pricing">Pricing</a><a href="/blog">Blog</a><a href='/blog/how-to-make-duo-dance'>Guide</a>
<a href="https://www.tiktok.com/@x">TikTok</a><a href="/api/video/soundtrack">x</a><a href="/pricing">again</a>
</body></html>`;

test("home page head checks", () => {
  assert.equal(countH1(HOME), 1);
  assert.equal(countH1("<h1>a</h1><h1>b</h1>"), 2);
  assert.equal(pageTitle(HOME), "Duo Dance | Dance Booth");
  assert.equal(pageTitle("<p>none</p>"), null);
  assert.equal(canonicalHref(HOME), "https://dancebooth.app/");
  assert.equal(canonicalHref('<link rel="alternate" href="/x">'), null);
  const blocks = jsonLdBlocks(HOME);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { ok: true, types: ["Organization", "WebSite"] });
  assert.equal(blocks[1].ok, false);
});

test("internal links are distinct other pages; guides are spotted", () => {
  const links = internalLinks(HOME, "https://dancebooth.app/");
  assert.deepEqual(links, ["/blog", "/blog/how-to-make-duo-dance", "/pricing"]);
  assert.deepEqual(guideLinks(links), ["/blog/how-to-make-duo-dance"]);
});

test("placeholders and noindex headers fail the page", () => {
  assert.deepEqual(pagePlaceholders(HOME), []);
  const hits = pagePlaceholders("Welcome to YourBrand — support@example.com price_X_PLACEHOLDER");
  assert.equal(hits.length, 3);
  assert.equal(pagePlaceholders("my-example.com is fine").length, 0);
  assert.equal(isNoindex("noindex, nofollow"), true);
  assert.equal(isNoindex("max-video-preview:-1"), false);
  assert.equal(isNoindex(null), false);
});

test("the report is an aligned table", () => {
  const table = formatTable([
    { name: "home 200", status: "PASS", detail: "200" },
    { name: "sitemap.xml", status: "FAIL", detail: "status 404" },
  ]);
  const lines = table.split("\n");
  assert.equal(lines.length, 4);
  assert.match(lines[3], /^sitemap\.xml\s+FAIL\s+status 404$/);
});

test("the support address comes from site.generated.json only for the same domain", () => {
  const site = { domain: "dancebooth.app", supportEmail: "help@dancebooth.app" };
  assert.equal(resolveSupportEmail("https://dancebooth.app", { site }), "help@dancebooth.app");
  assert.equal(resolveSupportEmail("https://www.dancebooth.app", { site }), "help@dancebooth.app");
  assert.equal(resolveSupportEmail("https://other.app", { site }), "support@other.app");
  assert.equal(resolveSupportEmail("https://other.app", { site: null }), "support@other.app");
  assert.equal(
    resolveSupportEmail("https://other.app", { site, override: "team@mail.other.app" }),
    "team@mail.other.app",
  );
});

test("example and reserved domains are recognised", () => {
  for (const domain of ["example.com", "api.example.org", "shop.test", "x.example", "localhost"]) {
    assert.equal(isExampleDomain(domain), true, domain);
  }
  for (const domain of ["dancebooth.app", "my-example.com", "example.community"]) {
    assert.equal(isExampleDomain(domain), false, domain);
  }
});

test("MX answers are parsed by priority; a null MX has no exchange", () => {
  const parsed = parseMxAnswer({
    Status: 0,
    Answer: [
      { name: "dancebooth.app", type: 15, data: "86 route3.mx.cloudflare.net." },
      { name: "dancebooth.app", type: 5, data: "alias.example." },
      { name: "dancebooth.app", type: 15, data: "12 route1.mx.cloudflare.net." },
    ],
  });
  assert.deepEqual(parsed, {
    status: 0,
    records: [
      { priority: 12, exchange: "route1.mx.cloudflare.net" },
      { priority: 86, exchange: "route3.mx.cloudflare.net" },
    ],
  });
  assert.deepEqual(parseMxAnswer({ Status: 0, Answer: [{ type: 15, data: "0 ." }] }).records, [
    { priority: 0, exchange: "" },
  ]);
  assert.deepEqual(parseMxAnswer({ Status: 0 }).records, []);
});

/** A fetch that answers DNS-over-HTTPS queries from `answers` (domain → JSON body). */
function fakeDns(answers, calls = []) {
  return async (url, init) => {
    calls.push({ url, accept: init?.headers?.accept });
    const name = new URL(url).searchParams.get("name");
    if (!(name in answers)) return new Response("boom", { status: 502 });
    return new Response(JSON.stringify(answers[name]), { status: 200 });
  };
}

test("the support inbox check needs MX records on the address's domain", async () => {
  const calls = [];
  const fetchDns = fakeDns(
    {
      "dancebooth.app": {
        Status: 0,
        Answer: [
          { type: 15, data: "12 route1.mx.cloudflare.net." },
          { type: 15, data: "86 route2.mx.cloudflare.net." },
        ],
      },
      "nomail.app": { Status: 0 },
      "nullmx.app": { Status: 0, Answer: [{ type: 15, data: "0 ." }] },
      "gone.app": { Status: 3 },
      "broken.app": { Status: 2 },
      "xn--mnchen-3ya.de": { Status: 0, Answer: [{ type: 15, data: "10 mx.mnchen.de." }] },
    },
    calls,
  );
  const [status, detail] = await supportInboxCheck(
    "https://dancebooth.app",
    "support@dancebooth.app",
    fetchDns,
  );
  assert.equal(status, "PASS");
  assert.match(detail, /route1\.mx\.cloudflare\.net \(\+1\)/);
  assert.equal(calls[0].url, `${DNS_OVER_HTTPS}?name=dancebooth.app&type=MX`);
  assert.equal(calls[0].accept, "application/dns-json");

  const none = await supportInboxCheck("https://nomail.app", "support@nomail.app", fetchDns);
  assert.equal(none[0], "FAIL");
  assert.match(none[1], /no MX records/);
  assert.match(none[1], /Cloudflare Email Routing \(launch checklist A10\)/);
  assert.match(none[1], /real test mail \(E14\)/);
  assert.match(
    (await supportInboxCheck("https://nullmx.app", "support@nullmx.app", fetchDns))[1],
    /null MX/,
  );
  assert.match(
    (await supportInboxCheck("https://gone.app", "support@gone.app", fetchDns))[1],
    /NXDOMAIN/,
  );
  assert.match(
    (await supportInboxCheck("https://broken.app", "support@broken.app", fetchDns))[1],
    /DNS status 2/,
  );
  // Unicode domains are looked up as punycode.
  assert.equal((await supportInboxCheck("https://x.app", "hi@münchen.de", fetchDns))[0], "PASS");
  // The address's own domain is looked up, not the site's.
  const other = await supportInboxCheck("https://site.app", "help@dancebooth.app", fetchDns);
  assert.equal(other[0], "PASS");
  await assert.rejects(
    supportInboxCheck("https://site.app", "support@unknown.app", fetchDns),
    /status 502/,
  );
});

test("the support inbox check is skipped for local bases and example domains", async () => {
  const fetchDns = () => assert.fail("no DNS lookup expected");
  assert.deepEqual(
    await supportInboxCheck("http://localhost:3000", "support@dancebooth.app", fetchDns),
    ["SKIP", "local base URL"],
  );
  assert.equal(
    (await supportInboxCheck("https://example.com", "support@example.com", fetchDns))[0],
    "SKIP",
  );
  assert.equal(
    (await supportInboxCheck("https://dancebooth.app", "not-an-address", fetchDns))[0],
    "FAIL",
  );
});

test("the share image comes from og:image", () => {
  assert.equal(
    ogImageUrl('<meta property="og:image" content="https://dancebooth.app/og/og.png">'),
    "https://dancebooth.app/og/og.png",
  );
  assert.equal(ogImageUrl('<meta name="og:image" content="/og.png" />'), "/og.png");
  assert.equal(ogImageUrl("<meta property=og:title content=x>"), null);
});

test("served brand files that are the template's own are named", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const logo = readFileSync(join(root, "apps/web/public/logo.svg"));
  const og = readFileSync(join(root, "apps/web/public/og/og.png"));
  assert.deepEqual(
    templateBrandFiles([
      { url: "/logo.svg", bytes: logo },
      { url: "https://dancebooth.app/og/og.png?v=2", bytes: og },
      { url: "/favicon.ico", bytes: Buffer.from("our own icon") },
    ]),
    ["/logo.svg", "/og/og.png"],
  );
  // A CRLF copy of the logo is still the template's.
  const crlf = Buffer.from(logo.toString("utf8").replace(/\n/g, "\r\n"));
  assert.deepEqual(templateBrandFiles([{ url: "/logo.svg", bytes: crlf }]), ["/logo.svg"]);
});
