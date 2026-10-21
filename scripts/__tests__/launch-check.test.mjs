import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalHref,
  countH1,
  formatTable,
  guideLinks,
  hasSitemapLine,
  internalLinks,
  isHomeRedirect,
  isLocalBase,
  isNoindex,
  jsonLdBlocks,
  lastmodsAllToday,
  missingCrawlers,
  normalizeBase,
  pagePlaceholders,
  pageTitle,
  parseSitemap,
  redirectsTo,
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
