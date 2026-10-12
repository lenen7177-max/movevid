import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Existing server tests use node:test; this config covers Vitest suites only.
    include: ["src/payments/application/**/*.test.ts"],
  },
});
