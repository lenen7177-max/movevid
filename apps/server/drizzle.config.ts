import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load production Cloudflare credentials for remote D1 migrations.
config({ path: ".env.production" });

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
// The database the worker is bound to: site.config.jsonc → wrangler.jsonc (`pnpm site:sync`).
const boundDatabaseId = /"database_id":\s*"([^"]+)"/.exec(
  readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8"),
)?.[1];
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || boundDatabaseId;

if (!(accountId && token && databaseId)) {
  throw new Error(
    "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN (apps/server/.env.production), or the D1 id in site.config.jsonc",
  );
}
if (boundDatabaseId && databaseId !== boundDatabaseId) {
  throw new Error(
    `CLOUDFLARE_D1_DATABASE_ID (${databaseId}) is not the D1 database in wrangler.jsonc (${boundDatabaseId}); remove it from .env.production`,
  );
}

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId,
    databaseId,
    token,
  },
});
