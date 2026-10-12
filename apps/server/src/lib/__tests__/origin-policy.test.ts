import assert from "node:assert/strict";
import test from "node:test";
import { createOriginPolicy } from "../origin-policy";

test("trusts the apex host when WEBSITE_URL is the www host", () => {
  const policy = createOriginPolicy({
    nodeEnv: "production",
    websiteUrl: "https://www.example.com",
  });
  assert.equal(policy.resolveCorsOrigin("https://www.example.com"), "https://www.example.com");
  assert.equal(policy.resolveCorsOrigin("https://example.com"), "https://example.com");
  assert.deepEqual(policy.trustedBrowserOrigins, [
    "https://www.example.com",
    "https://example.com",
  ]);
});

test("trusts the www host when WEBSITE_URL is the apex host", () => {
  const policy = createOriginPolicy({
    nodeEnv: "production",
    websiteUrl: "https://example.com/",
  });
  assert.equal(policy.resolveCorsOrigin("https://www.example.com"), "https://www.example.com");
});

test("still rejects unrelated origins", () => {
  const policy = createOriginPolicy({
    nodeEnv: "production",
    websiteUrl: "https://www.example.com",
  });
  assert.equal(policy.resolveCorsOrigin("https://evil.example.com"), undefined);
  assert.equal(policy.resolveCorsOrigin("https://wwwexample.com"), undefined);
});

test("leaves localhost alone", () => {
  const policy = createOriginPolicy({ nodeEnv: "production", websiteUrl: "http://localhost:3000" });
  assert.deepEqual(policy.trustedBrowserOrigins, ["http://localhost:3000"]);
});
