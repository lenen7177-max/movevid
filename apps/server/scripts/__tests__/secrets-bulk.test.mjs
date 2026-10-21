import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  LOCAL_ONLY_KEYS,
  describeSelection,
  parseEnvText,
  selectSecrets,
} from "../secrets-bulk.mjs";

const ENV = `# Better Auth
BETTER_AUTH_SECRET=auth-value
ADMIN_EMAIL=

# Cloudflare (local only)
CLOUDFLARE_ACCOUNT_ID=account-value
CLOUDFLARE_API_TOKEN=token-value
CLOUDFLARE_D1_DATABASE_ID=

STRIPE_SECRET_KEY="stripe value with spaces"
STRIPE_WEBHOOK_SECRET='   '
export APIMART_API_KEY=apimart-value
WAFFO_ENVIRONMENT=prod
RESEND_API_KEY= # unused provider
`;

test("env files parse with comments, quotes and export", () => {
  const entries = parseEnvText(`﻿${ENV}`);
  assert.equal(entries.BETTER_AUTH_SECRET, "auth-value");
  assert.equal(entries.STRIPE_SECRET_KEY, "stripe value with spaces");
  assert.equal(entries.APIMART_API_KEY, "apimart-value");
  assert.equal(entries.ADMIN_EMAIL, "");
});

test("a blank value with trailing spaces doesn't swallow the next line", () => {
  const entries = parseEnvText(
    "RESEND_API_KEY= \nSTRIPE_SECRET_KEY=sk_live_a\r\nADMIN_EMAIL=\t\r\nX=1",
  );
  assert.deepEqual(entries, {
    RESEND_API_KEY: "",
    STRIPE_SECRET_KEY: "sk_live_a",
    ADMIN_EMAIL: "",
    X: "1",
  });
});

test("empty values and local-only keys are left out", () => {
  const selection = selectSecrets(parseEnvText(ENV));
  assert.deepEqual(selection.upload, {
    BETTER_AUTH_SECRET: "auth-value",
    STRIPE_SECRET_KEY: "stripe value with spaces",
    APIMART_API_KEY: "apimart-value",
    WAFFO_ENVIRONMENT: "prod",
  });
  assert.deepEqual(selection.empty.sort(), [
    "ADMIN_EMAIL",
    "RESEND_API_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]);
  assert.deepEqual(selection.localOnly, LOCAL_ONLY_KEYS);
});

test("the printed plan names keys, never values", () => {
  const text = describeSelection(selectSecrets(parseEnvText(ENV))).join("\n");
  assert.match(text, /Uploading 4 secrets:/);
  assert.match(text, /\+ BETTER_AUTH_SECRET/);
  assert.match(text, /Skipped, empty: ADMIN_EMAIL, RESEND_API_KEY, STRIPE_WEBHOOK_SECRET/);
  assert.match(text, /Skipped, local only \(db:migrate\): CLOUDFLARE_ACCOUNT_ID/);
  for (const value of ["auth-value", "token-value", "account-value", "stripe value", "apimart"]) {
    assert.ok(!text.includes(value), value);
  }
});

test("--dry-run prints the plan and uploads nothing", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "secrets-bulk-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, ".env.production");
  writeFileSync(file, ENV);
  const script = fileURLToPath(new URL("../secrets-bulk.mjs", import.meta.url));
  // An empty PATH: if the script tried to run wrangler it would fail.
  const result = spawnSync(process.execPath, [script, "--dry-run", "--file", file], {
    encoding: "utf8",
    env: { PATH: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Uploading 4 secrets/);
  assert.match(result.stdout, /Dry run: nothing uploaded/);
  assert.ok(!result.stdout.includes("auth-value"));

  writeFileSync(file, "ADMIN_EMAIL=\nCLOUDFLARE_API_TOKEN=token-value\n");
  const empty = spawnSync(process.execPath, [script, "--dry-run", `--file=${file}`], {
    encoding: "utf8",
  });
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /Nothing to upload/);
});

test(
  "the secrets reach wrangler on stdin, with no file argument",
  { skip: process.platform === "win32" },
  (t) => {
    const dir = mkdtempSync(join(tmpdir(), "secrets-bulk-test-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, ".env.production");
    writeFileSync(file, ENV);
    const received = join(dir, "received");
    // A fake wrangler that records its arguments and stdin.
    writeFileSync(
      join(dir, "wrangler"),
      `#!/bin/sh\necho "$@" > "${received}.args"\necho "$CLOUDFLARE_ACCOUNT_ID" > "${received}.account"\ncat > "${received}.json"\n`,
      { mode: 0o755 },
    );
    const script = fileURLToPath(new URL("../secrets-bulk.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script, "--file", file], {
      encoding: "utf8",
      // WRANGLER_BIN: never the real wrangler, even if apps/server/node_modules/.bin has one.
      env: { PATH: "/usr/bin:/bin", WRANGLER_BIN: join(dir, "wrangler") },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(`${received}.args`, "utf8").trim(), "secret bulk");
    // The account id from the env file reaches wrangler, which can't prompt for one.
    assert.equal(readFileSync(`${received}.account`, "utf8").trim(), "account-value");
    assert.deepEqual(JSON.parse(readFileSync(`${received}.json`, "utf8")), {
      BETTER_AUTH_SECRET: "auth-value",
      STRIPE_SECRET_KEY: "stripe value with spaces",
      APIMART_API_KEY: "apimart-value",
      WAFFO_ENVIRONMENT: "prod",
    });
  },
);
