#!/usr/bin/env node
// Deploy gate: `pnpm check:placeholders` (also run by `pnpm deploy:server` and `pnpm deploy:web`).
// Exits 1 while any of these is true, so nothing half-configured reaches Cloudflare:
//   - a template placeholder (example.com, your-project, <YOUR_…>, …) is still in the repo
//   - site.config.jsonc has a malformed value (domain, worker or bucket name, D1 id, rate-limit
//     namespace ids that are not positive integers or repeat)
//   - a file generated from site.config.jsonc is out of date (`pnpm site:sync`)
//   - the generated wrangler.jsonc routes don't match the domain, or the rate-limit ids collide
//   - a local .env file or the shell sets a VITE_* URL/key, or the D1 id for migrations, to
//     something other than what site.config.jsonc says (they would win over it at build time)
//   - something that looks like a committed secret
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { parseJsonc, stripJsoncComments } from "./lib/jsonc.mjs";
import { countPlaceholders, isPlaceholder } from "./lib/placeholders.mjs";
import {
  GENERATED_FILES,
  SITE_CONFIG_FILE,
  readSiteConfig,
  siteTokens,
  staleSiteFiles,
  validateSiteConfig,
} from "./site-sync.mjs";

const SECRETS = [
  /\bsk_(?:live|test)_[A-Za-z0-9]{10,}/,
  /\brk_(?:live|test)_[A-Za-z0-9]{10,}/,
  /\bwhsec_[A-Za-z0-9]{10,}/,
  /\bre_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

// Files where placeholders are expected to stay (docs, tests, these scripts). Generated files
// are left out too: their source is site.config.jsonc, and staleness is checked separately.
const IGNORE = [
  /^scripts\/(?:check-placeholders|site-sync)\.mjs$/,
  /^scripts\/lib\//,
  /\.md$/,
  /__tests__\//,
  /\.example$/,
  /pnpm-lock\.yaml$/,
  /migrations\/meta\//,
  /worker-configuration\.d\.ts$/,
  /emails\/templates\//,
  /sidebar-data\.ts$/,
  ...GENERATED_FILES.map((path) => new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)),
];

let files;
try {
  // Paths are read from the project root (the folder holding scripts/), whichever directory
  // this runs in and even when the project sits inside a larger git repository.
  process.chdir(fileURLToPath(new URL("..", import.meta.url)));
  files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
} catch {
  console.error("Run this inside the git repository.");
  process.exit(2);
}
// The site config is checked even if someone git-ignores it like a private .env file.
if (existsSync(SITE_CONFIG_FILE) && !files.includes(SITE_CONFIG_FILE)) files.push(SITE_CONFIG_FILE);

const placeholderHits = new Map();
const secretHits = new Set();

for (const file of files) {
  if (/\.(png|jpe?g|gif|webp|ico|mp4|m4a|woff2?)$/i.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const secret of SECRETS) {
    if (secret.test(text)) secretHits.add(file);
  }
  if (IGNORE.some((pattern) => pattern.test(file))) continue;
  // Comments in .jsonc files (examples like "help@example.com") are not settings.
  if (file.endsWith(".jsonc")) {
    try {
      text = stripJsoncComments(text);
    } catch {}
  }
  for (const [label, count] of countPlaceholders(text)) {
    const entry = placeholderHits.get(label) ?? [];
    entry.push(`${file} (${count})`);
    placeholderHits.set(label, entry);
  }
}

let config = null;
let siteIssues = [];
try {
  config = readSiteConfig(process.cwd());
  siteIssues = validateSiteConfig(config);
} catch (error) {
  siteIssues = [`${SITE_CONFIG_FILE}: ${error.message}`];
}
const stale = config && !siteIssues.length ? staleSiteFiles(config, process.cwd()) : [];

/**
 * Checks on the generated wrangler.jsonc files themselves (routes, service binding, rate-limit
 * ids). They follow from site.config.jsonc, so this runs only once that is valid and synced,
 * and skips values that are still placeholders (already reported above).
 */
function deployConfigIssues(tokens) {
  const issues = [];
  const read = (file) => {
    try {
      return parseJsonc(readFileSync(file, "utf8"));
    } catch (error) {
      issues.push(`${file}: could not parse (${error.message})`);
      return null;
    }
  };
  const hostOf = (url) => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  };
  const real = (value) => value && !isPlaceholder(value);

  const server = read("apps/server/wrangler.jsonc");
  if (server) {
    const file = "apps/server/wrangler.jsonc";
    const routes = (server.routes ?? []).filter((route) => route.custom_domain);
    const serverHost = hostOf(server.vars?.SERVER_URL);
    if (routes.length === 0) issues.push(`${file}: no custom_domain route for the API`);
    for (const { pattern } of routes) {
      if (!real(pattern)) continue;
      if (pattern !== tokens.apiHost) {
        issues.push(`${file}: API route "${pattern}" is not api.<domain> ("${tokens.apiHost}")`);
      }
      if (real(serverHost) && pattern !== serverHost) {
        issues.push(`${file}: API route "${pattern}" differs from SERVER_URL host "${serverHost}"`);
      }
    }
    const seen = new Map();
    for (const limiter of server.ratelimits ?? []) {
      const id = String(limiter.namespace_id ?? "");
      if (!real(id)) continue;
      if (!/^[1-9]\d*$/.test(id)) {
        issues.push(`${file}: ${limiter.name} namespace_id "${id}" must be a positive integer`);
      } else if (seen.has(id)) {
        issues.push(`${file}: ${limiter.name} reuses namespace_id ${id} of ${seen.get(id)}`);
      }
      seen.set(id, limiter.name);
    }
  }

  const web = read("apps/web/wrangler.jsonc");
  if (web && server) {
    const file = "apps/web/wrangler.jsonc";
    const patterns = (web.routes ?? []).map((route) => route.pattern);
    if (real(tokens.domain) && !patterns.includes(tokens.domain)) {
      issues.push(`${file}: no route for the site domain "${tokens.domain}"`);
    }
    const apiHost = hostOf(web.vars?.VITE_SERVER_URL);
    if (real(apiHost) && apiHost !== tokens.apiHost) {
      issues.push(`${file}: VITE_SERVER_URL host "${apiHost}" is not "${tokens.apiHost}"`);
    }
    const service = web.services?.find((entry) => entry.binding === "API_SERVICE")?.service;
    if (real(service) && real(server.name) && service !== server.name) {
      issues.push(
        `${file}: API_SERVICE points at "${service}", not the server worker "${server.name}"`,
      );
    }
  }
  return issues;
}

/** KEY=value pairs of an env file, or {} when it doesn't exist. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  try {
    return parseEnv(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return {};
  }
}

/**
 * Values that win over site.config.jsonc at build or migration time: VITE_* entries in
 * apps/web/.env files (vite loads them before wrangler.jsonc vars) or in this shell, and the D1
 * id `pnpm db:migrate` reads from apps/server/.env.production. Only a value that differs from
 * the generated one is a problem.
 */
function overrideIssues() {
  const issues = [];
  const web = parseJsonc(readFileSync("apps/web/wrangler.jsonc", "utf8"));
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local", "shell"]) {
    const values = name === "shell" ? process.env : readEnvFile(`apps/web/${name}`);
    const where = name === "shell" ? "the environment" : `apps/web/${name}`;
    for (const [key, expected] of Object.entries(web.vars ?? {})) {
      const value = values[key];
      if (key.startsWith("VITE_") && value && value !== expected) {
        issues.push(
          `${where} sets ${key}=${value}, but site.config.jsonc gives "${expected}"; remove it there`,
        );
      }
    }
  }
  const server = parseJsonc(readFileSync("apps/server/wrangler.jsonc", "utf8"));
  const databaseId = server.d1_databases?.[0]?.database_id;
  for (const name of [".env.production", "shell"]) {
    const value =
      name === "shell"
        ? process.env.CLOUDFLARE_D1_DATABASE_ID
        : readEnvFile(`apps/server/${name}`).CLOUDFLARE_D1_DATABASE_ID;
    if (value && databaseId && value !== databaseId) {
      const where = name === "shell" ? "the environment" : `apps/server/${name}`;
      issues.push(
        `${where} sets CLOUDFLARE_D1_DATABASE_ID=${value}, but site.config.jsonc's D1 id is ${databaseId}; \`pnpm db:migrate\` would migrate the wrong database`,
      );
    }
  }
  return issues;
}

const deployIssues =
  config && !siteIssues.length && !stale.length
    ? [...deployConfigIssues(siteTokens(config)), ...overrideIssues()]
    : [];

if (placeholderHits.size) {
  console.log("Placeholders still to replace:\n");
  for (const [label, entries] of placeholderHits) {
    console.log(`• ${label}`);
    for (const entry of entries) console.log(`    ${entry}`);
  }
}
if (siteIssues.length) {
  console.log(`\n${SITE_CONFIG_FILE} needs fixing:\n`);
  for (const issue of siteIssues) console.log(`• ${issue}`);
}
if (stale.length) {
  console.log(`\nOut of date with ${SITE_CONFIG_FILE}; run \`pnpm site:sync\`:\n`);
  for (const path of stale) console.log(`• ${path}`);
}
if (deployIssues.length) {
  console.log("\nDeploy config to fix:\n");
  for (const issue of deployIssues) console.log(`• ${issue}`);
}
if (secretHits.size) {
  console.error(`\n✗ Possible secrets committed in:\n    ${[...secretHits].join("\n    ")}`);
}

const problems =
  placeholderHits.size + siteIssues.length + stale.length + deployIssues.length + secretHits.size;
if (problems) {
  console.error("\n✗ Not ready to deploy: fix the items above (see SETUP.md).");
  process.exit(1);
}
console.log("✓ No placeholders left; site config and generated files are in order.");
