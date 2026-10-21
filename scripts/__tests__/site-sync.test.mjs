import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "../lib/jsonc.mjs";
import { countPlaceholders } from "../lib/placeholders.mjs";
import {
  readSiteConfig,
  renderSiteFiles,
  renderTemplate,
  siteTokens,
  socialSignIn,
  staleSiteFiles,
  validateSiteConfig,
} from "../site-sync.mjs";
import { filledSiteConfig } from "./fixtures.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("the committed generated files match site.config.jsonc", () => {
  const config = readSiteConfig(ROOT);
  assert.deepEqual(validateSiteConfig(config), []);
  assert.deepEqual(staleSiteFiles(config, ROOT), [], "run `pnpm site:sync`");
});

test("a filled-in config validates and renders without placeholders", () => {
  const config = filledSiteConfig();
  assert.deepEqual(validateSiteConfig(config), []);
  const files = renderSiteFiles(config, ROOT);
  for (const [path, content] of files) {
    assert.deepEqual(countPlaceholders(content), [], path);
  }
  const server = parseJsonc(files.get("apps/server/wrangler.jsonc"));
  const web = parseJsonc(files.get("apps/web/wrangler.jsonc"));
  assert.equal(server.name, "dancebooth-server");
  assert.deepEqual(server.routes, [{ pattern: "api.dancebooth.app", custom_domain: true }]);
  assert.equal(server.vars.SERVER_URL, "https://api.dancebooth.app");
  assert.equal(server.vars.WEBSITE_URL, "https://dancebooth.app");
  assert.equal(server.d1_databases[0].database_id, config.cloudflare.d1DatabaseId);
  assert.deepEqual(
    server.ratelimits.map((limiter) => limiter.namespace_id),
    ["3001", "3002"],
  );
  assert.deepEqual(
    web.routes.map((route) => route.pattern),
    ["dancebooth.app", "www.dancebooth.app"],
  );
  assert.equal(web.services[0].service, "dancebooth-server");
  assert.equal(web.vars.VITE_TURNSTILE_SITE_KEY, config.turnstileSiteKey);
  assert.equal(JSON.parse(files.get("apps/web/public/manifest.webmanifest")).name, "Dance Booth");
  assert.deepEqual(JSON.parse(files.get("packages/app-config/src/site.generated.json")), {
    name: "Dance Booth",
    domain: "dancebooth.app",
    supportEmail: "support@dancebooth.app",
    socialUrls: [],
    emailProvider: "resend",
    socialSignIn: { google: false, github: false },
  });
  const withSocials = renderSiteFiles(
    filledSiteConfig({ socialUrls: ["https://www.tiktok.com/@dancebooth"] }),
    ROOT,
  );
  assert.deepEqual(
    JSON.parse(withSocials.get("packages/app-config/src/site.generated.json")).socialUrls,
    ["https://www.tiktok.com/@dancebooth"],
  );
});

test("the send_email binding is generated only for the cloudflare email provider", () => {
  const render = (overrides) => renderSiteFiles(filledSiteConfig(overrides), ROOT);
  const server = (files) => parseJsonc(files.get("apps/server/wrangler.jsonc"));
  const site = (files) => JSON.parse(files.get("packages/app-config/src/site.generated.json"));

  const byDefault = render({});
  assert.equal(server(byDefault).send_email, undefined);
  assert.equal(site(byDefault).emailProvider, "resend"); // the fixture's value
  const resend = render({ emailProvider: "resend" });
  assert.equal(
    resend.get("apps/server/wrangler.jsonc"),
    byDefault.get("apps/server/wrangler.jsonc"),
  );

  const cloudflare = render({ emailProvider: "cloudflare" });
  assert.deepEqual(server(cloudflare).send_email, [{ name: "EMAIL" }]);
  assert.equal(site(cloudflare).emailProvider, "cloudflare");
  // Apart from the binding, the two outputs are the same file.
  const withoutBinding = cloudflare
    .get("apps/server/wrangler.jsonc")
    .replace(/\n  "send_email": \[\n    \{\n      "name": "EMAIL",\n    \},\n  \],/, "");
  assert.equal(withoutBinding, byDefault.get("apps/server/wrangler.jsonc"));
});

test("social sign-in is on exactly when its client id is set", () => {
  const signIn = (publicIds) => {
    const config = filledSiteConfig({ public: publicIds });
    const site = JSON.parse(
      renderSiteFiles(config, ROOT).get("packages/app-config/src/site.generated.json"),
    );
    assert.deepEqual(site.socialSignIn, socialSignIn(config));
    return site.socialSignIn;
  };
  assert.deepEqual(signIn({ githubClientId: "", googleClientId: "" }), {
    google: false,
    github: false,
  });
  assert.deepEqual(signIn({}), { google: false, github: false });
  assert.deepEqual(signIn({ googleClientId: "1234-abc.apps.googleusercontent.com" }), {
    google: true,
    github: false,
  });
  assert.deepEqual(signIn({ githubClientId: "Ov23liAbCdEf12345678" }), {
    google: false,
    github: true,
  });
  assert.deepEqual(signIn({ githubClientId: "   ", googleClientId: "" }), {
    google: false,
    github: false,
  });
  // Only the flags reach site.generated.json, never the ids.
  const json = renderSiteFiles(
    filledSiteConfig({ public: { googleClientId: "1234-abc.apps.googleusercontent.com" } }),
    ROOT,
  ).get("packages/app-config/src/site.generated.json");
  assert.ok(!json.includes("googleusercontent"));
});

test("OAuth client ids are checked for shape and pasted secrets", () => {
  const issues = (publicIds) =>
    validateSiteConfig(filledSiteConfig({ public: publicIds })).join("\n");
  assert.equal(issues({ googleClientId: "1234-abc.apps.googleusercontent.com" }), "");
  assert.equal(issues({ githubClientId: "Iv1.0123456789abcdef" }), "");
  assert.match(
    issues({ googleClientId: "GOCSPX-abcdef" }),
    /googleClientId looks like the client secret/,
  );
  assert.match(issues({ googleClientId: "1234-abc" }), /must be the OAuth client ID ending in/);
  assert.match(
    issues({ githubClientId: "0123456789abcdef0123456789abcdef01234567" }),
    /githubClientId looks like the client secret/,
  );
  assert.match(issues({ githubClientId: "has space" }), /githubClientId "has space" must be/);
});

test("emailProvider must be a known provider", () => {
  const { emailProvider: _omitted, ...missing } = filledSiteConfig();
  assert.match(validateSiteConfig(missing).join("\n"), /emailProvider is required/);
  assert.deepEqual(validateSiteConfig(filledSiteConfig({ emailProvider: "cloudflare" })), []);
  assert.deepEqual(validateSiteConfig(filledSiteConfig({ emailProvider: "resend" })), []);
  assert.match(
    validateSiteConfig(filledSiteConfig({ emailProvider: "sendgrid" })).join("\n"),
    /emailProvider "sendgrid" must be one of "resend", "cloudflare"/,
  );
  assert.match(
    validateSiteConfig(filledSiteConfig({ emailProvider: "" })).join("\n"),
    /emailProvider "" must be one of/,
  );
});

test("//#if blocks keep or drop lines by a token's value", () => {
  const template = [
    "{",
    '  "a": 1,',
    '  //#if mode == "on"',
    '  "on": true,',
    '  //#if extra != ""',
    '  "extra": "{{extra}}",',
    "  //#endif",
    "  //#endif",
    '//#if mode != "on"',
    '  "off": true,',
    "//#endif",
    "}",
  ].join("\n");
  const render = (tokens) => parseJsonc(renderTemplate(template, tokens, "t.jsonc"));
  assert.deepEqual(render({ mode: "on", extra: "x" }), { a: 1, on: true, extra: "x" });
  assert.deepEqual(render({ mode: "on", extra: "" }), { a: 1, on: true });
  assert.deepEqual(render({ mode: "off", extra: "x" }), { a: 1, off: true });
  assert.throws(() => renderTemplate('//#if nope == "x"\n//#endif', {}, "t"), /unknown token nope/);
  assert.throws(
    () => renderTemplate('//#if mode == "x"\n', { mode: "x" }, "t"),
    /without \/\/#endif/,
  );
  assert.throws(() => renderTemplate("//#endif\n", {}, "t"), /without \/\/#if/);
  assert.throws(() => renderTemplate("//#if mode\n//#endif", { mode: "x" }, "t"), /write \/\/#if/);
  assert.throws(
    () => renderTemplate('//#if mode == "x"\n//#else\n//#endif', { mode: "x" }, "t"),
    /unknown directive \/\/#else/,
  );
  // Notes (`//# text`) are still dropped, not mistaken for directives.
  assert.deepEqual(parseJsonc(renderTemplate("//# a note\n{}", {}, "t")), {});
});

test("rate-limit namespace ids accept numbers and must be distinct positive integers", () => {
  const withIds = (authEmailIp, authEmailAddress) =>
    filledSiteConfig({
      cloudflare: {
        ...filledSiteConfig().cloudflare,
        rateLimitNamespaceIds: { authEmailIp, authEmailAddress },
      },
    });
  assert.deepEqual(validateSiteConfig(withIds(3001, 3002)), []);
  assert.match(validateSiteConfig(withIds("3001", "3001")).join("\n"), /reuses namespace id 3001/);
  assert.match(validateSiteConfig(withIds("abc", "3002")).join("\n"), /must be a positive integer/);
  assert.match(validateSiteConfig(withIds("0", "3002")).join("\n"), /must be a positive integer/);
  assert.match(validateSiteConfig(withIds("", "3002")).join("\n"), /is required/);
  // Placeholders are reported by the placeholder scan, not twice here.
  assert.deepEqual(validateSiteConfig(withIds("<YOUR_RATELIMIT_NAMESPACE_ID_1>", "3002")), []);
});

test("malformed site values are reported with their path", () => {
  const cloudflare = filledSiteConfig().cloudflare;
  const cases = [
    [{ domain: "https://dancebooth.app" }, /domain .* must be a lowercase apex domain/],
    [{ domain: "www.dancebooth.app" }, /should be the apex domain/],
    [{ domain: "DanceBooth.app" }, /domain .* must be a lowercase apex domain/],
    [{ mediaUrl: "http://media.dancebooth.app" }, /mediaUrl .* must be an https:\/\/ URL/],
    [{ supportEmail: "nobody" }, /supportEmail .* must be an email address/],
    [{ socialUrls: "https://x.com/dancebooth" }, /socialUrls must be a list/],
    [{ socialUrls: ["http://x.com/dancebooth"] }, /socialUrls\[0\] .* must be an https:\/\/ URL/],
    [{ socialUrls: [""] }, /socialUrls\[0\] must be a non-empty string/],
    [{ socialUrls: ["https://x.com/a", "https://x.com/a"] }, /socialUrls\[1\] .* listed twice/],
    [{ turnstileSiteKey: "" }, /turnstileSiteKey is required/],
    [{ domian: "typo.app" }, /domian is not a known setting/],
    [{ cloudflare: { ...cloudflare, webWorker: "Dance_Web" } }, /webWorker .* must be lowercase/],
    [{ cloudflare: { ...cloudflare, webWorker: "same", serverWorker: "same" } }, /different/],
    [{ cloudflare: { ...cloudflare, r2Bucket: "ab" } }, /r2Bucket .* must be 3–63/],
    [{ cloudflare: { ...cloudflare, d1DatabaseId: "not-a-uuid" } }, /d1DatabaseId .* UUID/],
    [{ cloudflare: { ...cloudflare, d1DatabaseName: undefined } }, /d1DatabaseName is required/],
    [{ cloudflare: undefined }, /cloudflare is required/],
    [{ public: { gaId: "G-1" } }, /public\.gaId is not a known setting/],
  ];
  for (const [overrides, expected] of cases) {
    const issues = validateSiteConfig(filledSiteConfig(overrides)).join("\n");
    assert.match(issues, expected, JSON.stringify(overrides));
  }
});

test("templates drop //# notes, escape values and reject unknown tokens", () => {
  const template = '//# note for template readers\n{\n  "name": "{{name}}"\n}\n';
  const out = renderTemplate(template, { name: 'Say "hi" \\ bye' }, "t.jsonc");
  assert.ok(out.startsWith("// Generated by `pnpm site:sync`"));
  assert.ok(!out.includes("note for template readers"));
  assert.equal(parseJsonc(out).name, 'Say "hi" \\ bye');
  assert.throws(() => renderTemplate('{"a": "{{missing}}"}', {}, "t.jsonc"), /unknown token/);
});

test("every token the templates use is provided", () => {
  const tokens = siteTokens(filledSiteConfig());
  for (const template of [
    "apps/server/wrangler.template.jsonc",
    "apps/web/wrangler.template.jsonc",
  ]) {
    const source = readFileSync(resolve(ROOT, template), "utf8")
      .split("\n")
      .filter((line) => !line.startsWith("//#"))
      .join("\n");
    for (const [, key] of source.matchAll(/\{\{(\w+)\}\}/g)) {
      assert.ok(key in tokens, `${template} uses {{${key}}}`);
    }
  }
});

test("tokens may have inner spaces; a malformed one is an error, not output", () => {
  assert.equal(parseJsonc(renderTemplate('{"a": "{{ name }}"}', { name: "x" }, "t")).a, "x");
  assert.throws(() => renderTemplate('{"a": "{{name}"}', { name: "x" }, "t.jsonc"), /\{\{/);
});

test("a BOM, CRLF line ends and punycode domains are accepted", () => {
  assert.deepEqual(parseJsonc('﻿{\r\n  "a": 1, // note\r\n}\r\n'), { a: 1 });
  assert.deepEqual(validateSiteConfig(filledSiteConfig({ domain: "xn--fiqs8s.xn--55qx5d" })), []);
});

test("placeholder hosts are matched whole, not inside other names", () => {
  const labels = (text) =>
    countPlaceholders(text)
      .map(([label]) => label)
      .join(",");
  assert.equal(labels("https://my-example.com https://example.community"), "");
  assert.match(labels('"https://api.example.com"'), /example\.com/);
  assert.equal(labels("my-your-project-db"), "");
  assert.match(labels('"your-project-web"'), /your-project/);
});
