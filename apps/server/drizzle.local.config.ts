import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

function findLocalD1DatabaseFile() {
  const baseDir = resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(baseDir)) return null;
  const entries = readdirSync(baseDir).filter((entry) => entry.endsWith(".sqlite"));
  const preferred = entries.find((entry) => entry !== "local.sqlite");
  const sqliteFile = preferred ?? entries[0];
  return sqliteFile ? join(baseDir, sqliteFile) : null;
}

const localDbPath = process.env.LOCAL_D1_DB_PATH ?? findLocalD1DatabaseFile();

if (!localDbPath) {
  throw new Error(
    "Local D1 database not found. Run `pnpm run dev:init-d1` to initialize it or set LOCAL_D1_DB_PATH to the sqlite file.",
  );
}

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: localDbPath.startsWith("file:") ? localDbPath : `file:${localDbPath}`,
  },
});
