import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run source tests so stale compiled copies in dist/ are never picked up.
    include: ["src/**/*.test.ts"],
  },
});
