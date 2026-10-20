// IndexNow (Bing, Yandex, Seznam, Naver; Bing's index also feeds ChatGPT search).
//   node scripts/indexnow.mjs --key-file   before `vite build`: writes public/<key>.txt
//   node scripts/indexnow.mjs              after `wrangler deploy`: submits new or changed pages
//   node scripts/indexnow.mjs --all        submits every page in the sitemap
//   node scripts/indexnow.mjs --dry-run    lists what would be submitted; sends and writes nothing
// "Changed" is decided by content, not dates: each live page is fetched and hashed (title, meta,
// JSON-LD, links and visible text; build-specific asset URLs and scripts are left out). Hashes
// are compared with indexnow-sent.json, the record of the last successful submission, which is
// rewritten and committed after every successful ping (on a branch; a detached HEAD only gets
// the file). Push that commit so the next deploy starts from it. Nothing is submitted until the
// live site serves this build and https://<host>/<key>.txt.
// The key comes from INDEXNOW_KEY (shell, CI, or apps/web/.env.production). Leave it unset to
// skip both steps. Failures only warn: this must never fail a build or a deploy.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ENDPOINT = "https://api.indexnow.org/indexnow";
// https://www.indexnow.org/documentation: 8–128 characters of a-z, A-Z, 0-9 and dashes.
const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;
// apps/web/.gitignore ignores public/ + 32 characters + .txt (the length of generated keys).
const GITIGNORED_KEY_LENGTH = 32;
const MAX_URLS_PER_PING = 10_000;
const FETCH_CONCURRENCY = 4;
const LIVE_BUILD_TIMEOUT_MS = 90_000;

const appDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = resolve(appDir, "public");
const clientDir = resolve(appDir, "dist/client");
export const RECORD_FILE = resolve(appDir, "indexnow-sent.json");
const log = (message) => process.stdout.write(`[indexnow] ${message}\n`);
/** Runs git in apps/web without ever waiting on a prompt (credentials, signing pinentry). */
const git = (...args) =>
  execFileSync("git", args, {
    cwd: appDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function readKey() {
  let key = process.env.INDEXNOW_KEY;
  for (const name of [".env.production.local", ".env.production", ".env"]) {
    if (key) break;
    const file = resolve(appDir, name);
    if (existsSync(file)) key = parseEnv(await readFile(file, "utf8")).INDEXNOW_KEY;
  }
  key = key?.trim();
  if (key && !KEY_PATTERN.test(key)) {
    log("INDEXNOW_KEY must be 8–128 letters, digits or dashes; skipped");
    return null;
  }
  return key || null;
}

/**
 * Writes public/<key>.txt (the key and nothing else) and drops key files left by older keys.
 * Keys of another length than the .gitignore pattern covers go into .git/info/exclude instead.
 */
async function writeKeyFile(key) {
  for (const name of await readdir(publicDir)) {
    const stem = name.replace(/\.txt$/, "");
    if (name === `${key}.txt` || stem === name || !KEY_PATTERN.test(stem)) continue;
    const path = resolve(publicDir, name);
    // An IndexNow key file is named after its own content; anything else is left alone.
    if ((await readFile(path, "utf8")).trim() === stem) await unlink(path);
  }
  await writeFile(resolve(publicDir, `${key}.txt`), key);
  log(`wrote public/${key}.txt`);
  if (key.length !== GITIGNORED_KEY_LENGTH) excludeLocally(resolve(publicDir, `${key}.txt`));
}

function excludeLocally(file) {
  try {
    const root = git("rev-parse", "--show-toplevel");
    // --git-path answers relative to the directory git ran in.
    const exclude = resolve(appDir, git("rev-parse", "--git-path", "info/exclude"));
    const pattern = `/${relative(root, file).split("\\").join("/")}`;
    const current = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
    if (!current.split("\n").includes(pattern)) appendFileSync(exclude, `\n${pattern}\n`);
  } catch {
    // Not a git checkout (e.g. a deploy from an archive): nothing to keep out of git.
  }
}

/** Every page URL in the sitemap, with its hreflang alternates (separate URLs to crawl). */
export function sitemapUrls(xml) {
  const urls = new Set();
  for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    for (const [, href] of entry.matchAll(/(?:<loc>|href=")(https?:\/\/[^<"]+)/g)) {
      urls.add(href.trim());
    }
  }
  return [...urls];
}

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

/** Hashed bundle files and inline data change with every build without the page changing. */
const isBuildAsset = (value) => /(?:^|\/)assets\/|^(?:data|blob):/.test(value);
/** Cloudflare's email obfuscation re-encodes addresses on every request. */
const stableLink = (value) => value.replace(/(\/cdn-cgi\/l\/email-protection)#[0-9a-f]*/gi, "$1");

/**
 * What a page says, without what a build adds: title, meta tags, canonical and hreflang links,
 * JSON-LD, link targets, media and alt text, and the visible text. Scripts, styles, hashed
 * asset URLs and generated element ids are dropped, so a rebuild of unchanged content hashes
 * the same.
 */
export function pageContent(html) {
  const parts = [];
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? "";
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  if (title) parts.push(`title ${title.trim()}`);
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attribute(tag, "name") ?? attribute(tag, "property");
    const content = attribute(tag, "content");
    if (key && content !== undefined && !isBuildAsset(content))
      parts.push(`meta ${key}=${content}`);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel");
    if (rel !== "canonical" && rel !== "alternate") continue;
    parts.push(`link ${rel} ${attribute(tag, "hreflang") ?? ""} ${attribute(tag, "href") ?? ""}`);
  }
  for (const [, json] of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    parts.push(`ld ${json.trim()}`);
  }

  const body = (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? "")
    .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of body.match(/<[a-z][^>]*>/gi) ?? []) {
    for (const name of ["href", "src", "poster", "alt"]) {
      const value = attribute(tag, name);
      if (value && !isBuildAsset(value)) parts.push(`${name} ${stableLink(value)}`);
    }
  }
  parts.push(
    `text ${body
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()}`,
  );
  return parts.join("\n");
}

export function contentHash(html) {
  return createHash("sha256").update(pageContent(html)).digest("hex").slice(0, 16);
}

/**
 * Which URLs to submit: with `all`, every one; otherwise those that are new to the record or
 * whose hash changed. A page that could not be fetched (hash null) is submitted, since its
 * content can't be compared.
 */
export function urlsToSubmit(urls, hashes, record, { all = false } = {}) {
  if (all) return [...urls];
  return urls.filter((url) => hashes.get(url) == null || record[url] !== hashes.get(url));
}

/**
 * The record after a successful ping: submitted URLs take their new hash (a page that could not
 * be fetched keeps its old one, or stays out, so it is compared again next time), URLs that left
 * the sitemap are dropped (so they count as new if they come back), keys sorted for stable diffs.
 */
export function nextRecord(record, urls, hashes, submitted) {
  const sent = new Set(submitted);
  const entries = urls
    .map((url) => [url, sent.has(url) ? (hashes.get(url) ?? record[url]) : record[url]])
    .filter(([, hash]) => hash);
  return Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function serializeRecord(record) {
  return `${JSON.stringify(record, null, 2)}\n`;
}

async function readRecord() {
  try {
    const record = JSON.parse(await readFile(RECORD_FILE, "utf8"));
    return record && typeof record === "object" && !Array.isArray(record) ? record : {};
  } catch {
    return {};
  }
}

/**
 * Waits until the live site answers with this build's id, so the hashes are of new content.
 * With `wait` false (dry runs) it checks once and only reports a mismatch.
 */
async function waitForLiveBuild(origin, { wait = true } = {}) {
  let expected;
  try {
    expected = (await readFile(resolve(appDir, "dist/.build-id"), "utf8")).trim();
  } catch {
    log("dist/.build-id is missing; hashing whatever the live site serves");
    return true;
  }
  const deadline = Date.now() + (wait ? LIVE_BUILD_TIMEOUT_MS : 0);
  let live = "unknown";
  do {
    try {
      const response = await fetch(`${origin}/api/pwa-version?t=${Date.now()}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) live = (await response.json()).buildId ?? live;
      if (live === expected) return true;
    } catch {}
    if (wait) await sleep(3_000);
  } while (Date.now() < deadline);
  log(`live site serves build ${live}, not this build (${expected})`);
  return false;
}

/** IndexNow fetches https://<host>/<key>.txt to verify the key; without it every ping is void. */
async function keyFileIsLive(origin, key) {
  try {
    const response = await fetch(`${origin}/${key}.txt?t=${Date.now()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok && (await response.text()).trim() === key) return true;
    log(`${origin}/${key}.txt does not serve the key (HTTP ${response.status})`);
  } catch (error) {
    log(`could not fetch ${origin}/${key}.txt (${error instanceof Error ? error.message : error})`);
  }
  return false;
}

async function hashLivePages(urls) {
  const hashes = new Map();
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "indexnow-sync (+https://www.indexnow.org)" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        hashes.set(url, contentHash(await response.text()));
      } catch (error) {
        hashes.set(url, null);
        log(`could not fetch ${url} (${error instanceof Error ? error.message : error})`);
      }
    }
  };
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
  return hashes;
}

async function submit(host, key, urlList) {
  for (let start = 0; start < urlList.length; start += MAX_URLS_PER_PING) {
    const batch = urlList.slice(start, start + MAX_URLS_PER_PING);
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: batch,
      }),
    });
    // 200 = accepted, 202 = accepted while the key is still being verified.
    const ok = response.status === 200 || response.status === 202;
    log(`${ok ? "submitted" : "rejected"} ${batch.length} URLs (HTTP ${response.status})`);
    if (!ok) {
      log(await response.text());
      return false;
    }
  }
  return true;
}

/**
 * Commits the record if it differs from HEAD (also retrying a record an earlier run wrote but
 * could not commit). Only that file is committed, whatever else is staged; it is data, so commit
 * hooks are skipped. On a detached HEAD (typical in CI) the commit would be lost, so it is left
 * to the caller.
 */
export function commitRecord(message, { changed }) {
  const file = relative(process.cwd(), RECORD_FILE) || RECORD_FILE;
  let status;
  try {
    status = git("status", "--porcelain", "--", RECORD_FILE);
  } catch {
    if (changed) log(`updated ${file}; not a git checkout, so keep it for the next deploy`);
    return;
  }
  if (!status) return;
  let added = false;
  try {
    try {
      git("symbolic-ref", "-q", "HEAD");
    } catch {
      log(`HEAD is detached, so ${file} was updated but not committed; commit it on your branch`);
      return;
    }
    if (status.startsWith("??")) {
      git("add", "--", RECORD_FILE);
      added = true;
    }
    git("commit", "--no-verify", "-m", message, "--", RECORD_FILE);
    log(`committed ${file}; push it so the next deploy compares against it`);
  } catch (error) {
    if (added) {
      try {
        git("reset", "-q", "--", RECORD_FILE);
      } catch {}
    }
    const reason =
      error?.stderr?.toString().trim() || (error instanceof Error ? error.message : error);
    log(`updated ${file} but could not commit it: ${reason}`);
  }
}

async function ping(key, { all, dryRun }) {
  if (!existsSync(resolve(clientDir, `${key}.txt`))) {
    log(`dist/client/${key}.txt is missing; build with INDEXNOW_KEY set so the key file deploys`);
  }

  let xml;
  try {
    xml = await readFile(resolve(clientDir, "sitemap.xml"), "utf8");
  } catch {
    log("no built sitemap, skipped");
    return;
  }
  const urls = sitemapUrls(xml);
  if (urls.length === 0) {
    log("sitemap has no URLs");
    return;
  }
  const { host, origin } = new URL(urls[0]);
  if (/^(?:localhost|127\.|\[::1\])/.test(host)) {
    log(`sitemap points at ${host}; set VITE_APP_URL to the live site. Skipped`);
    return;
  }

  if (!(await waitForLiveBuild(origin, { wait: !dryRun }))) {
    if (dryRun) {
      log("dry run: hashing the build that is live now");
    } else {
      log("nothing submitted; run `pnpm -F web indexnow` once the deploy is live");
      return;
    }
  }
  const hashes = await hashLivePages(urls);
  const record = await readRecord();
  const pending = urlsToSubmit(urls, hashes, record, { all });
  const skipped = urls.length - pending.length;
  const next = nextRecord(record, urls, hashes, pending);

  if (dryRun) {
    if (pending.length) await keyFileIsLive(origin, key);
    log(`dry run: would submit ${pending.length} of ${urls.length} URLs`);
    for (const url of pending) log(`  ${record[url] ? "changed" : "new"}  ${url}`);
    return;
  }

  let submitted = 0;
  if (pending.length === 0) {
    log(`no new or changed URLs (${urls.length} checked)`);
  } else {
    if (!(await keyFileIsLive(origin, key))) {
      log("nothing submitted; deploy a build made with INDEXNOW_KEY set, then run it again");
      return;
    }
    try {
      if (!(await submit(host, key, pending))) return;
    } catch (error) {
      log(`ping failed: ${error instanceof Error ? error.message : error}`);
      return;
    }
    submitted = pending.length;
    if (skipped) log(`${skipped} unchanged URLs not resubmitted`);
  }

  const serialized = serializeRecord(next);
  const current = existsSync(RECORD_FILE) ? await readFile(RECORD_FILE, "utf8") : null;
  const changed = serialized !== current;
  if (changed) await writeFile(RECORD_FILE, serialized);
  const removed = Object.keys(record).filter((url) => !(url in next) && !urls.includes(url));
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  commitRecord(
    submitted
      ? `chore(indexnow): record ${plural(submitted, "submitted URL")}`
      : removed.length
        ? `chore(indexnow): drop ${plural(removed.length, "URL")} no longer in the sitemap`
        : "chore(indexnow): update the IndexNow record",
    { changed },
  );
}

async function main() {
  const key = await readKey();
  if (!key) {
    log("INDEXNOW_KEY not set, skipped");
  } else if (process.argv.includes("--key-file")) {
    await writeKeyFile(key);
  } else {
    await ping(key, {
      all: process.argv.includes("--all"),
      dryRun: process.argv.includes("--dry-run"),
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
