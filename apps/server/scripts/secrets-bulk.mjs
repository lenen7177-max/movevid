#!/usr/bin/env node
// Uploads apps/server/.env.production as worker secrets: `pnpm -F server secrets:bulk:production`.
// Unlike a plain `wrangler secret bulk .env.production` it
//   - skips keys left empty, so an unused provider's blank key doesn't overwrite a real secret
//     with "" (or create an empty one)
//   - skips the local-only keys drizzle.config.ts reads for `pnpm db:migrate`
//     (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID)
//   - prints the key names it uploads and skips, never their values
// It pipes the selected keys as JSON to `wrangler secret bulk` (stdin, so no secrets file is
// written) in apps/server, so wrangler.jsonc picks the worker. With stdin piped wrangler can't
// prompt: run `wrangler login` first (or set CLOUDFLARE_API_TOKEN), and the env file's
// CLOUDFLARE_ACCOUNT_ID tells it which account to use when the login sees several.
// WRANGLER_BIN overrides the wrangler executable (the tests use a fake one).
//   --dry-run        print what would be uploaded, upload nothing
//   --file <path>    read another env file (default: apps/server/.env.production)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

/** Keys only drizzle.config.ts uses on this machine; they are not worker secrets. */
export const LOCAL_ONLY_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_D1_DATABASE_ID",
];

const SERVER_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** KEY=value pairs of an env file's text (comments, quotes and `export` handled by Node). */
export function parseEnvText(text) {
  const cleaned = text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    // Node's parser reads `KEY= ` (blank value, trailing space) as KEY = the whole next line.
    .replace(/[ \t]+$/gm, "")
    .replace(/^\s*export\s+/gm, "");
  return parseEnv(cleaned);
}

/**
 * Splits env entries into { upload, empty, localOnly }: `upload` maps the keys to send to their
 * values, the other two list the key names left out (blank values, local-only keys).
 */
export function selectSecrets(entries) {
  const upload = {};
  const empty = [];
  const localOnly = [];
  for (const [key, value] of Object.entries(entries)) {
    if (LOCAL_ONLY_KEYS.includes(key)) localOnly.push(key);
    else if (String(value ?? "").trim() === "") empty.push(key);
    else upload[key] = value;
  }
  return { upload, empty, localOnly };
}

/** The plan as printable lines: key names only. */
export function describeSelection({ upload, empty, localOnly }) {
  const names = Object.keys(upload).sort();
  const lines = [`Uploading ${names.length} secret${names.length === 1 ? "" : "s"}:`];
  for (const key of names) lines.push(`  + ${key}`);
  if (empty.length) lines.push(`Skipped, empty: ${[...empty].sort().join(", ")}`);
  if (localOnly.length) {
    lines.push(`Skipped, local only (db:migrate): ${[...localOnly].sort().join(", ")}`);
  }
  return lines;
}

function parseArgs(argv) {
  const options = { dryRun: false, file: join(SERVER_DIR, ".env.production") };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--file") options.file = resolve(argv[++index] ?? "");
    else if (arg.startsWith("--file=")) options.file = resolve(arg.slice("--file=".length));
    else if (arg === "--") continue;
    else throw new Error(`unknown argument ${arg} (use --dry-run, --file <path>)`);
  }
  return options;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (!existsSync(options.file)) {
    console.error(
      `${options.file} not found. Copy apps/server/.env.production.example to it and fill it in.`,
    );
    process.exit(1);
  }
  const entries = parseEnvText(readFileSync(options.file, "utf8"));
  const selection = selectSecrets(entries);
  console.log(`From ${options.file}`);
  for (const line of describeSelection(selection)) console.log(line);
  if (Object.keys(selection.upload).length === 0) {
    console.error("Nothing to upload: every worker secret is empty.");
    process.exit(1);
  }
  if (options.dryRun) {
    console.log("\nDry run: nothing uploaded.");
    return;
  }

  const local = join(SERVER_DIR, "node_modules/.bin/wrangler");
  const windows = process.platform === "win32";
  const command = process.env.WRANGLER_BIN || (existsSync(local) ? local : "wrangler");
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || entries.CLOUDFLARE_ACCOUNT_ID?.trim();
  // Windows needs a shell for wrangler.cmd; quote the path in case it has spaces.
  const result = spawnSync(windows ? `"${command}"` : command, ["secret", "bulk"], {
    cwd: SERVER_DIR,
    env: accountId ? { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId } : process.env,
    input: JSON.stringify(selection.upload),
    stdio: ["pipe", "inherit", "inherit"],
    shell: windows,
  });
  if (result.error) console.error(`Could not run wrangler: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
