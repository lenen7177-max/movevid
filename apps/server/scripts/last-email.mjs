#!/usr/bin/env node
// Local dev only: `wrangler dev` does not deliver email, it saves each message under
// .wrangler/tmp/email/. This prints the newest one's verification code and links.
//   pnpm -F server dev:last-email
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../.wrangler/tmp/email/", import.meta.url).pathname;

function htmlFiles(dir) {
  let found = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found = found.concat(htmlFiles(path));
    else if (entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

const files = htmlFiles(root).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (files.length === 0) {
  console.log("No emails yet. Request a code on the sign-in page first.");
  process.exit(0);
}

const newest = files[0];
const html = readFileSync(newest, "utf8");
const text = html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
const code = text.match(/\b\d{6}\b/)?.[0];
const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
const sentAt = new Date(statSync(newest).mtimeMs).toLocaleTimeString();

console.log(`Newest email (${sentAt})`);
if (code) console.log(`Code: ${code}`);
for (const link of new Set(links)) console.log(`Link: ${link.replace(/&amp;/g, "&")}`);
