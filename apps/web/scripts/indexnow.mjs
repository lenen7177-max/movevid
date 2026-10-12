// Pings IndexNow (Bing, Yandex, Seznam, Naver; Bing's index also feeds ChatGPT search) with the
// pages that changed recently, read from the built sitemap. Runs after `wrangler deploy`.
//   node scripts/indexnow.mjs          pages whose <lastmod> is today or yesterday (UTC)
//   node scripts/indexnow.mjs --all    every page in the sitemap
// A failed ping only warns: it must never fail a deploy.
import { readFile } from "node:fs/promises";

// Public by design: IndexNow verifies it against https://<host>/<key>.txt, so also add
// public/<key>.txt containing the key. Generate one at https://www.bing.com/indexnow/getstarted.
// Leave INDEXNOW_KEY unset to skip the ping.
const KEY = process.env.INDEXNOW_KEY;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const RECENT_DAYS = 1;

const sitemapPath = new URL("../dist/client/sitemap.xml", import.meta.url);
if (!KEY) {
  process.stdout.write("[indexnow] INDEXNOW_KEY not set, skipped\n");
  process.exit(0);
}
const submitAll = process.argv.includes("--all");

let xml;
try {
  xml = await readFile(sitemapPath, "utf8");
} catch {
  process.stdout.write("[indexnow] no built sitemap, skipped\n");
  process.exit(0);
}

const cutoff = new Date();
cutoff.setUTCHours(0, 0, 0, 0);
cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_DAYS);

const urls = new Set();
for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(entry)?.[1];
  if (!submitAll && (!lastmod || new Date(lastmod) < cutoff)) continue;
  // The page itself plus its zh/jp alternates, which are separate URLs to crawl.
  for (const [, href] of entry.matchAll(/(?:<loc>|href=")(https?:\/\/[^<"]+)/g)) {
    urls.add(href);
  }
}

if (urls.size === 0) {
  process.stdout.write("[indexnow] no recently changed pages\n");
  process.exit(0);
}

const urlList = [...urls];
const { host } = new URL(urlList[0]);

try {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: KEY,
      keyLocation: `https://${host}/${KEY}.txt`,
      urlList,
    }),
  });
  // 200 = accepted, 202 = accepted while the key is still being verified.
  const ok = response.status === 200 || response.status === 202;
  process.stdout.write(
    `[indexnow] ${ok ? "submitted" : "rejected"} ${urlList.length} URLs (HTTP ${response.status})\n`,
  );
  if (!ok) process.stdout.write(`[indexnow] ${await response.text()}\n`);
} catch (error) {
  process.stdout.write(
    `[indexnow] ping failed: ${error instanceof Error ? error.message : error}\n`,
  );
}
