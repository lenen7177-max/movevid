import assert from "node:assert/strict";
import test from "node:test";
import { classifyAcquisitionChannel } from "../acquisition-channel";

test("classifies AI assistants, including ChatGPT's utm_source", () => {
  assert.equal(classifyAcquisitionChannel({ referrerHost: "chatgpt.com" }), "chatgpt");
  assert.equal(classifyAcquisitionChannel({ utmSource: "chatgpt.com" }), "chatgpt");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "www.perplexity.ai" }), "perplexity");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "gemini.google.com" }), "gemini");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "claude.ai" }), "claude");
});

test("classifies search engines and social networks", () => {
  assert.equal(classifyAcquisitionChannel({ referrerHost: "www.google.com.br" }), "google");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "cn.bing.com" }), "bing");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "yandex.ru" }), "yandex");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "t.co" }), "x");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "l.facebook.com" }), "facebook");
  assert.equal(classifyAcquisitionChannel({ utmSource: "TikTok" }), "tiktok");
});

test("utm_source wins over the referrer; unknown sources are referral; nothing is direct", () => {
  assert.equal(classifyAcquisitionChannel({ referrerHost: "t.co", utmSource: "reddit" }), "reddit");
  assert.equal(classifyAcquisitionChannel({ referrerHost: "crunchbase.com" }), "referral");
  assert.equal(classifyAcquisitionChannel({ utmSource: "newsletter" }), "referral");
  assert.equal(classifyAcquisitionChannel({}), "direct");
});
