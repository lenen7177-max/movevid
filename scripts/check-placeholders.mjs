#!/usr/bin/env node
// Lists template placeholders that still need your real values, and flags anything that
// looks like a committed secret. Run before deploying: `pnpm check:placeholders`.
// Exit code 1 when a secret-looking value is found, so it can also run in CI.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PLACEHOLDERS = [
  { label: "example.com domain", pattern: /\b(?:api\.|media\.|www\.)?example\.com\b/g },
  { label: "your-project name", pattern: /\byour-project\b/g },
  { label: "PLACEHOLDER price/key", pattern: /[A-Z_]*PLACEHOLDER[A-Z_]*/g },
  { label: "<YOUR_…> value", pattern: /<YOUR_[A-Z0-9_]+>/g },
  { label: "zero UUID", pattern: /00000000-0000-0000-0000-000000000000/g },
  { label: "YourBrand name", pattern: /\bYourBrand\b/g },
];

const SECRETS = [
  /\bsk_(?:live|test)_[A-Za-z0-9]{10,}/,
  /\brk_(?:live|test)_[A-Za-z0-9]{10,}/,
  /\bwhsec_[A-Za-z0-9]{10,}/,
  /\bre_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

// Files where placeholders are expected to stay (docs, tests, this script).
const IGNORE = [
  /^scripts\/check-placeholders\.mjs$/,
  /\.md$/,
  /__tests__\//,
  /\.example$/,
  /pnpm-lock\.yaml$/,
  /migrations\/meta\//,
  /worker-configuration\.d\.ts$/,
  /emails\/templates\//,
  /sidebar-data\.ts$/,
];

let files;
try {
  files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
} catch {
  console.error("Run this inside the git repository.");
  process.exit(2);
}

const placeholderHits = new Map();
const secretHits = [];

for (const file of files) {
  if (/\.(png|jpe?g|gif|webp|ico|mp4|m4a|woff2?)$/i.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const secret of SECRETS) {
    if (secret.test(text)) secretHits.push(file);
  }
  if (IGNORE.some((pattern) => pattern.test(file))) continue;
  for (const { label, pattern } of PLACEHOLDERS) {
    const count = text.match(pattern)?.length ?? 0;
    if (count) {
      const entry = placeholderHits.get(label) ?? [];
      entry.push(`${file} (${count})`);
      placeholderHits.set(label, entry);
    }
  }
}

if (placeholderHits.size === 0) {
  console.log("✓ No template placeholders left.");
} else {
  console.log("Placeholders still to replace:\n");
  for (const [label, entries] of placeholderHits) {
    console.log(`• ${label}`);
    for (const entry of entries) console.log(`    ${entry}`);
  }
}

if (secretHits.length) {
  console.error(`\n✗ Possible secrets committed in:\n    ${[...new Set(secretHits)].join("\n    ")}`);
  process.exit(1);
}
