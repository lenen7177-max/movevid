import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EXAMPLE_BLOG_POSTS,
  EXAMPLE_TEMPLATE_IDS,
  TEMPLATE_BRAND_ASSETS,
  readVideoTemplateIds,
  sha256,
  templateDefaults,
  templateDefaultsReport,
} from "../lib/template-defaults.mjs";
import { readSiteConfig } from "../site-sync.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// The base template (site.config.jsonc still names "YourBrand") ships every default; a site's
// own copy skips these two checks.
const isBaseTemplate = readSiteConfig(ROOT).name === "YourBrand";

test("the template's brand files match the stored hashes", (t) => {
  if (!isBaseTemplate) return t.skip("not the base template");
  const { brandAssets } = templateDefaults(ROOT);
  for (const { path, sha256: hashes } of TEMPLATE_BRAND_ASSETS) {
    assert.ok(hashes.includes(sha256(resolve(ROOT, path))), `${path} hash`);
  }
  assert.equal(brandAssets.length, TEMPLATE_BRAND_ASSETS.length);
});

test("example template ids are read from video.ts", (t) => {
  if (!isBaseTemplate) return t.skip("not the base template");
  assert.deepEqual(readVideoTemplateIds(ROOT), EXAMPLE_TEMPLATE_IDS);
  assert.deepEqual(templateDefaults(ROOT).exampleTemplates, EXAMPLE_TEMPLATE_IDS);
  assert.ok(
    templateDefaults(ROOT).examplePosts.some((path) =>
      path.endsWith(`/${EXAMPLE_BLOG_POSTS[0]}.mdx`),
    ),
  );
});

test("nothing left means no report lines", () => {
  assert.deepEqual(
    templateDefaultsReport({ brandAssets: [], exampleTemplates: [], examplePosts: [] }),
    [],
  );
  const lines = templateDefaultsReport({
    brandAssets: [{ path: "apps/web/src/components/logos/svg/logo.tsx", note: "the header logo" }],
    exampleTemplates: ["duo_dance"],
    examplePosts: ["apps/web/content/blog/en/photo-tips.mdx"],
  });
  assert.match(lines.join("\n"), /logo\.tsx \(the header logo\)[\s\S]*duo_dance[\s\S]*photo-tips/);
});
