import assert from "node:assert/strict";
import test from "node:test";
import { isIndexableHost } from "../../src/lib/seo/indexable-host.ts";

const APP_URL = "https://example.com";

test("the canonical apex and its www variant stay indexable", () => {
  assert.equal(isIndexableHost("example.com", APP_URL), true);
  assert.equal(isIndexableHost("www.example.com", APP_URL), true);
  assert.equal(isIndexableHost("EXAMPLE.COM", APP_URL), true);
  assert.equal(isIndexableHost("example.com.", APP_URL), true);
  assert.equal(isIndexableHost("example.com", "https://example.com/"), true);
});

test("preview and other hosts are not indexable", () => {
  assert.equal(isIndexableHost("web.someone.workers.dev", APP_URL), false);
  assert.equal(isIndexableHost("abc123-web.someone.workers.dev", APP_URL), false);
  assert.equal(isIndexableHost("staging.example.com", APP_URL), false);
  assert.equal(isIndexableHost("example.com.evil.dev", APP_URL), false);
  assert.equal(isIndexableHost("localhost", APP_URL), false);
});

test("a www canonical URL keeps its apex indexable too", () => {
  assert.equal(isIndexableHost("www.example.com", "https://www.example.com"), true);
  assert.equal(isIndexableHost("example.com", "https://www.example.com"), true);
});

test("without a usable app URL every host stays indexable", () => {
  assert.equal(isIndexableHost("web.someone.workers.dev", undefined), true);
  assert.equal(isIndexableHost("web.someone.workers.dev", ""), true);
  assert.equal(isIndexableHost("web.someone.workers.dev", "not a url"), true);
});
