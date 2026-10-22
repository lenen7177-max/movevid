import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { filledSiteConfig } from "./fixtures.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// The files the gate reads: the scripts, the site config and what it generates.
const COPIED = [
  "scripts/check-placeholders.mjs",
  "scripts/site-sync.mjs",
  "scripts/lib",
  "apps/server/wrangler.template.jsonc",
  "apps/web/wrangler.template.jsonc",
  "apps/web/public/manifest.webmanifest",
];

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

/** A throwaway git repo holding a site whose config is `config`, already synced. */
function siteRepo(t, config) {
  const dir = mkdtempSync(join(tmpdir(), "site-gate-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of COPIED) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    cpSync(join(ROOT, path), join(dir, path), { recursive: true });
  }
  mkdirSync(join(dir, "packages/app-config/src"), { recursive: true });
  writeFileSync(join(dir, "site.config.jsonc"), JSON.stringify(config, null, 2));
  const sync = spawnSync(process.execPath, ["scripts/site-sync.mjs"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(sync.status, 0, sync.stderr);
  git(dir, "init", "-q");
  git(dir, "add", ".");
  return dir;
}

function gate(cwd) {
  return spawnSync(process.execPath, [join(cwd, "scripts/check-placeholders.mjs")], {
    cwd,
    encoding: "utf8",
  });
}

test("a fully configured site passes the gate", (t) => {
  const result = gate(siteRepo(t, filledSiteConfig()));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /No placeholders or template content left/);
});

test("the gate also passes from a subdirectory", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  const result = spawnSync(process.execPath, ["../../scripts/check-placeholders.mjs"], {
    cwd: join(dir, "apps/web"),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("leftover placeholders fail the gate", (t) => {
  const dir = siteRepo(t, filledSiteConfig({ domain: "example.com" }));
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /example\.com domain/);
});

test("placeholders inside site.config.jsonc comments don't count", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  const file = join(dir, "site.config.jsonc");
  writeFileSync(
    file,
    `// e.g. "domain": "example.com", "name": "YourBrand"\n${readFileSync(file, "utf8")}`,
  );
  const result = gate(dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("repeated rate-limit namespace ids fail the gate", (t) => {
  const config = filledSiteConfig();
  config.cloudflare.rateLimitNamespaceIds = { authEmailIp: "3001", authEmailAddress: "3001" };
  const dir = siteRepo(t, filledSiteConfig());
  writeFileSync(join(dir, "site.config.jsonc"), JSON.stringify(config));
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /reuses namespace id 3001/);
});

test("a hand-edited wrangler.jsonc is reported as out of date", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  const file = join(dir, "apps/server/wrangler.jsonc");
  writeFileSync(file, readFileSync(file, "utf8").replace('"3001"', '"3002"'));
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Out of date[\s\S]*apps\/server\/wrangler\.jsonc/);
});

test("an API route that is not api.<domain> fails the gate", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  const template = join(dir, "apps/server/wrangler.template.jsonc");
  writeFileSync(template, readFileSync(template, "utf8").replace("{{apiHost}}", "api.other.app"));
  spawnSync(process.execPath, ["scripts/site-sync.mjs"], { cwd: dir });
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /API route "api\.other\.app" is not api\.<domain>/);
  assert.match(result.stdout, /differs from SERVER_URL host "api\.dancebooth\.app"/);
});

test("a committed secret fails the gate", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  writeFileSync(join(dir, "leak.ts"), `const key = "sk_live_${"a".repeat(24)}";\n`);
  git(dir, "add", "leak.ts");
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Possible secrets committed in:\s+leak\.ts/);
});

test("the gate reads the project, not a parent repository it sits in", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "site-parent-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const dir = siteRepo(t, filledSiteConfig());
  cpSync(dir, join(parent, "site"), { recursive: true });
  rmSync(join(parent, "site/.git"), { recursive: true, force: true });
  git(parent, "init", "-q");
  git(parent, "add", ".");
  const result = gate(join(parent, "site"));
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("a .env value that would override site.config.jsonc fails the gate", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  writeFileSync(join(dir, "apps/web/.env.production"), "VITE_APP_URL=https://old.app\n");
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /apps\/web\/\.env\.production sets VITE_APP_URL=https:\/\/old\.app/);
  // The same value as site.config.jsonc is harmless.
  writeFileSync(join(dir, "apps/web/.env.production"), "VITE_APP_URL=https://dancebooth.app\n");
  assert.equal(gate(dir).status, 0);
});

test("changing emailProvider without `pnpm site:sync` is reported as out of date", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  writeFileSync(
    join(dir, "site.config.jsonc"),
    JSON.stringify(filledSiteConfig({ emailProvider: "cloudflare" })),
  );
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Out of date[\s\S]*apps\/server\/wrangler\.jsonc/);
  assert.match(result.stdout, /packages\/app-config\/src\/site\.generated\.json/);
  // Synced, the cloudflare provider gets its binding and passes.
  spawnSync(process.execPath, ["scripts/site-sync.mjs"], { cwd: dir });
  const synced = gate(dir);
  assert.equal(synced.status, 0, synced.stdout + synced.stderr);
  assert.match(readFileSync(join(dir, "apps/server/wrangler.jsonc"), "utf8"), /"send_email"/);
});

test("the cloudflare email provider without an EMAIL binding fails the gate", (t) => {
  const dir = siteRepo(t, filledSiteConfig({ emailProvider: "cloudflare" }));
  const template = join(dir, "apps/server/wrangler.template.jsonc");
  writeFileSync(
    template,
    readFileSync(template, "utf8").replace(/\s*"send_email": \[[\s\S]*?\],/, ""),
  );
  spawnSync(process.execPath, ["scripts/site-sync.mjs"], { cwd: dir });
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /emailProvider is "cloudflare" but there is no send_email binding/);
});

test("the template's own brand files fail the gate until replaced", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  // This site replaced its brand files, so the template's originals come from a fixture copy.
  for (const [path, fixture] of [
    ["apps/web/public/logo.svg", "logo.svg"],
    ["apps/web/public/og/og.png", "og/og.png"],
  ]) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    cpSync(join(ROOT, "scripts/__tests__/fixtures/template-brand", fixture), join(dir, path));
  }
  // A Windows checkout's CRLF logo is still the template's.
  const logo = join(dir, "apps/web/public/logo.svg");
  writeFileSync(logo, readFileSync(logo, "utf8").replace(/\r?\n/g, "\r\n"));
  git(dir, "add", ".");
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /launch checklist B9\/B11\/B12/);
  assert.match(
    result.stdout,
    /Brand files still the template's own[\s\S]*apps\/web\/public\/logo\.svg/,
  );
  assert.match(result.stdout, /apps\/web\/public\/og\/og\.png/);

  writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>\n');
  writeFileSync(join(dir, "apps/web/public/og/og.png"), "not the template's image");
  const replaced = gate(dir);
  assert.equal(replaced.status, 0, replaced.stdout + replaced.stderr);
});

test("example video templates and blog posts fail the gate until deleted", (t) => {
  const dir = siteRepo(t, filledSiteConfig());
  const video = join(dir, "packages/app-config/src/video.ts");
  const ids = (list) => `export const VIDEO_TEMPLATE_IDS = [${list}] as const;\n`;
  writeFileSync(video, ids('"duo_dance", "night_drive"'));
  const post = join(dir, "apps/web/content/blog/en/how-to-make-duo-dance.mdx");
  mkdirSync(dirname(post), { recursive: true });
  writeFileSync(post, "---\ntitle: x\n---\n");
  git(dir, "add", ".");
  const result = gate(dir);
  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /Example video templates still in VIDEO_TEMPLATE_IDS[^\n]*\n\s+duo_dance\n/,
  );
  assert.doesNotMatch(result.stdout, /night_drive/);
  assert.match(
    result.stdout,
    /Example blog posts[\s\S]*apps\/web\/content\/blog\/en\/how-to-make-duo-dance\.mdx/,
  );

  writeFileSync(video, ids('"night_drive"'));
  rmSync(post);
  const cleaned = gate(dir);
  assert.equal(cleaned.status, 0, cleaned.stdout + cleaned.stderr);
});
