import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  contentHash,
  nextRecord,
  pageContent,
  serializeRecord,
  sitemapUrls,
  urlsToSubmit,
} from "../indexnow.mjs";

/** A rendered page as the worker serves it; `build` stands in for what changes per build. */
function page({ build = "a1b2c3", title = "Duo Dance", body = "Two friends, one routine." } = {}) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charSet="utf-8"/><title>${title} | Brand</title>
<meta name="description" content="Upload two photos."/>
<meta property="og:video" content="https://media.site.app/templates/duo/1.mp4"/>
<link rel="canonical" href="https://site.app/templates/duo-dance"/>
<link rel="alternate" hrefLang="en" href="https://site.app/templates/duo-dance"/>
<link rel="stylesheet" href="/assets/index-${build}.css"/>
<link rel="modulepreload" href="/assets/main-${build}.js"/>
<script type="application/ld+json">{"@type":"VideoObject","name":"${title}"}</script>
</head><body>
<script>(function(){var theme="dark";})()</script>
<div id="base-ui-_R_${build}_" aria-controls="_R_${build}_"><h1>${title}</h1>
<!-- --><p>${body}</p>
<img src="/templates/duo/poster.svg" alt="Duo Dance poster"/>
<a href="/pricing">Pricing</a><img src="/assets/logo-${build}.png"/></div>
<script class="$tsr">self.$_TSR={build:"${build}"}</script>
<script type="module" src="/assets/client-${build}.js"></script>
</body></html>`;
}

test("a rebuild of the same content hashes the same", () => {
  assert.equal(contentHash(page({ build: "a1b2c3" })), contentHash(page({ build: "zz9y8x" })));
});

test("content changes change the hash", () => {
  const base = contentHash(page());
  assert.notEqual(contentHash(page({ title: "Duo Dance 2" })), base);
  assert.notEqual(contentHash(page({ body: "Two friends, a new routine." })), base);
  assert.notEqual(contentHash(page().replace("/pricing", "/studio")), base);
  assert.notEqual(contentHash(page().replace("Upload two photos.", "Upload photos.")), base);
});

test("the normalized content keeps what the page says and drops build details", () => {
  const content = pageContent(page());
  assert.match(content, /title Duo Dance \| Brand/);
  assert.match(content, /meta og:video=https:\/\/media\.site\.app/);
  assert.match(content, /link canonical {2}https:\/\/site\.app\/templates\/duo-dance/);
  assert.match(content, /ld \{"@type":"VideoObject"/);
  assert.match(content, /alt Duo Dance poster/);
  assert.match(content, /text Duo Dance Two friends, one routine\. Pricing/);
  assert.doesNotMatch(content, /assets\/|_R_|\$_TSR|theme=/);
});

test("sitemap URLs include hreflang alternates once each", () => {
  const xml = `<urlset><url><loc>https://site.app/</loc><lastmod>2026-01-01</lastmod>
<xhtml:link rel="alternate" href="https://site.app/" hreflang="en" /></url>
<url><loc>https://site.app/pricing</loc></url></urlset>`;
  assert.deepEqual(sitemapUrls(xml), ["https://site.app/", "https://site.app/pricing"]);
});

test("only new or changed pages are submitted, unless --all", () => {
  const urls = ["https://site.app/", "https://site.app/new", "https://site.app/edited"];
  const record = { "https://site.app/": "aaa", "https://site.app/edited": "old" };
  const hashes = new Map([
    ["https://site.app/", "aaa"],
    ["https://site.app/new", "bbb"],
    ["https://site.app/edited", "ccc"],
  ]);
  assert.deepEqual(urlsToSubmit(urls, hashes, record), [
    "https://site.app/new",
    "https://site.app/edited",
  ]);
  assert.deepEqual(urlsToSubmit(urls, hashes, record, { all: true }), urls);
  // A page that could not be fetched can't be compared, so it is submitted.
  hashes.set("https://site.app/", null);
  assert.ok(urlsToSubmit(urls, hashes, record).includes("https://site.app/"));
});

test("the record keeps unchanged hashes, takes new ones and drops removed pages", () => {
  const record = {
    "https://site.app/gone": "zzz",
    "https://site.app/": "aaa",
    "https://site.app/edited": "old",
  };
  const urls = ["https://site.app/edited", "https://site.app/", "https://site.app/broken"];
  const hashes = new Map([
    ["https://site.app/", "aaa"],
    ["https://site.app/edited", "new"],
    ["https://site.app/broken", null],
  ]);
  const next = nextRecord(record, urls, hashes, [
    "https://site.app/edited",
    "https://site.app/broken",
  ]);
  // Sorted keys; the unfetchable page is not recorded, so the next deploy submits it again.
  assert.deepEqual(Object.entries(next), [
    ["https://site.app/", "aaa"],
    ["https://site.app/edited", "new"],
  ]);
  assert.equal(serializeRecord(next), `${JSON.stringify(next, null, 2)}\n`);
});

test("Cloudflare's per-request email obfuscation doesn't change the hash", () => {
  const withEmail = (code) =>
    page({ body: `Mail <a href="/cdn-cgi/l/email-protection#${code}">[email&#160;protected]</a>` });
  assert.equal(contentHash(withEmail("8be3eef9")), contentHash(withEmail("41296e2b")));
});

test("a recorded page that could not be fetched keeps its last hash", () => {
  const record = { "https://site.app/": "aaa" };
  const hashes = new Map([["https://site.app/", null]]);
  const next = nextRecord(record, ["https://site.app/"], hashes, ["https://site.app/"]);
  assert.deepEqual(next, { "https://site.app/": "aaa" });
});

/** A git repo holding a copy of the script, so its record file lives in the repo. */
async function scriptRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), "indexnow-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scripts"));
  cpSync(fileURLToPath(new URL("../indexnow.mjs", import.meta.url)), join(dir, "scripts/x.mjs"));
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@test.invalid");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  git("commit", "-q", "--allow-empty", "-m", "init");
  const script = await import(pathToFileURL(join(dir, "scripts/x.mjs")).href);
  return { dir, git, script };
}

test("the record is committed on its own, and a commit that failed earlier is retried", async (t) => {
  const { dir, git, script } = await scriptRepo(t);
  writeFileSync(join(dir, "other.txt"), "staged");
  git("add", "other.txt");
  writeFileSync(script.RECORD_FILE, "{}\n");
  script.commitRecord("chore(indexnow): first", { changed: true });
  assert.equal(git("log", "-1", "--format=%s"), "chore(indexnow): first");
  assert.equal(git("show", "--name-only", "--format=", "HEAD"), "indexnow-sent.json");
  // What else was staged stays staged, uncommitted.
  assert.equal(git("status", "--porcelain", "--", "other.txt"), "A  other.txt");
  // Unchanged and committed: nothing to do.
  script.commitRecord("chore(indexnow): again", { changed: false });
  assert.equal(git("log", "-1", "--format=%s"), "chore(indexnow): first");
  // Written by an earlier run that could not commit: committed now even if unchanged since.
  writeFileSync(script.RECORD_FILE, '{\n  "https://site.app/": "aaa"\n}\n');
  script.commitRecord("chore(indexnow): retry", { changed: false });
  assert.equal(git("log", "-1", "--format=%s"), "chore(indexnow): retry");
});

test("on a detached HEAD the record is written but not committed", async (t) => {
  const { dir, git, script } = await scriptRepo(t);
  git("checkout", "-q", "--detach");
  writeFileSync(script.RECORD_FILE, "{}\n");
  script.commitRecord("chore(indexnow): first", { changed: true });
  assert.equal(git("log", "-1", "--format=%s"), "init");
  assert.match(readFileSync(join(dir, "indexnow-sent.json"), "utf8"), /\{\}/);
});
