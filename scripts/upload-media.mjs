#!/usr/bin/env node
/**
 * Uploads template media from media/ in this repo to the public media bucket, keeping the path:
 *   media/templates/<id>/reference.mp4  →  movevid-media/templates/<id>/reference.mp4
 * (served at https://media.movevid.com/templates/<id>/reference.mp4, see site.config.jsonc
 * mediaUrl). Only files whose content changed since the last upload are sent; the hashes are
 * kept in media/.uploaded.json, which CI commits with the IndexNow record.
 *
 * Usage: node scripts/upload-media.mjs [--dry-run]
 * Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (wrangler reads them).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const BUCKET = "movevid-media";
const ROOT = new URL("..", import.meta.url).pathname;
const MEDIA = join(ROOT, "media");
const RECORD = join(MEDIA, ".uploaded.json");
const dryRun = process.argv.includes("--dry-run");

const TYPES = {
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name.startsWith(".")) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(MEDIA)) {
  console.log("[media] no media/ folder, nothing to upload");
  process.exit(0);
}

const record = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")) : {};
let sent = 0;
for (const file of walk(MEDIA)) {
  const key = relative(MEDIA, file).split(sep).join("/");
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    console.log(`[media] skip ${key} (unknown type)`);
    continue;
  }
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (record[key] === hash) continue;
  console.log(`[media] ${dryRun ? "would upload" : "upload"} ${key}`);
  if (!dryRun) {
    execFileSync(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${BUCKET}/${key}`,
        "--file",
        file,
        "--content-type",
        type,
        "--cache-control",
        "public, max-age=3600",
        "--remote",
      ],
      { stdio: "inherit", cwd: join(ROOT, "apps/server") },
    );
    record[key] = hash;
    sent += 1;
  }
}
if (!dryRun) writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`);
console.log(`[media] ${sent} file(s) uploaded`);
