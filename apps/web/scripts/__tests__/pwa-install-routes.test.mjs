import assert from "node:assert/strict";
import test from "node:test";
import { isInstallPromptRoute } from "../../src/lib/pwa-install-routes.ts";

test("marketing and legal pages never show the install prompt", () => {
  for (const path of [
    "/",
    "/templates",
    "/templates/duo-dance",
    "/pricing",
    "/pricing/",
    "/blog",
    "/blog/how-to-make-duo-dance",
    "/blog/category/guides",
    "/privacy",
    "/terms",
  ]) {
    assert.equal(isInstallPromptRoute(path), false, path);
  }
});

test("the studio and dashboard may show it", () => {
  for (const path of ["/studio", "/works", "/credits/purchase", "/settings/profile"]) {
    assert.equal(isInstallPromptRoute(path), true, path);
  }
});

test("lookalike paths are not mistaken for marketing pages", () => {
  assert.equal(isInstallPromptRoute("/templatesx"), true);
  assert.equal(isInstallPromptRoute("/pricing/history"), true);
});
