/**
 * What every copy of the template starts with and replaces before launch: the template's own
 * brand files, its three example video templates and its example blog posts. The deploy gate
 * (scripts/check-placeholders.mjs) fails while any is still there.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Brand files as the template ships them, by SHA-256 (text files are hashed with LF line ends,
 * so a Windows checkout matches too). A file that is missing or differs counts as replaced.
 * `url` is where a deployed site serves it (`pnpm launch:check` compares the live copy).
 */
export const TEMPLATE_BRAND_ASSETS = [
  {
    path: "apps/web/public/logo.svg",
    url: "/logo.svg",
    sha256: ["277c4fca268b9dceb1082486cbfeb749978252a89c90aed16d182e72ae6f2885"],
  },
  {
    // The header and footer logo (BrandLogo) is drawn from this component, not from logo.svg.
    path: "apps/web/src/components/logos/svg/logo.tsx",
    sha256: ["6a70fbdae30c6aa4aeb3e1f478959cc66bd54ba22a5f72221bd008dd47939684"],
    note: "the header and footer logo",
  },
  {
    path: "apps/web/public/og/og.png",
    url: "/og/og.png",
    sha256: [
      "68df770efeda392ed5580315fd626f6798f41bfd72c24db998d266235427297c",
      // The first release's copy, before its color profile was stripped.
      "537ed052601096b67e003af36b7be8019210a3d7ab58bdc1deee59f445b14119",
    ],
    note: "share image, 1200 × 630",
  },
  {
    path: "apps/web/public/favicon.ico",
    url: "/favicon.ico",
    sha256: ["0161e4bf71d98ca7326b0d5ece4d03a3b59ef47a25e0335bdc4bc22e7d9cff21"],
    note: "and the favicon-*.ico sizes next to it",
  },
  {
    path: "apps/web/public/pwa/pwa-192x192.png",
    url: "/pwa/pwa-192x192.png",
    sha256: ["975777c7f6bd09ab07693596f83afca470b5f25631053bfda1828393808b9aaa"],
  },
  {
    path: "apps/web/public/pwa/pwa-512x512.png",
    url: "/pwa/pwa-512x512.png",
    sha256: ["d4bfdecfa03f101e0566d255fb2243dcbd4c3a014c16e9eab0d19f5002798328"],
  },
  {
    path: "apps/web/public/pwa/pwa-maskable-512x512.png",
    url: "/pwa/pwa-maskable-512x512.png",
    sha256: ["f1f9f4c3c72237d92edb50bdf017bdf41206a1bfda6f9252c326af67115adf1a"],
  },
];

/** The template's example video templates (VIDEO_TEMPLATE_IDS in packages/app-config/src/video.ts). */
export const EXAMPLE_TEMPLATE_IDS = ["duo_dance", "solo_spotlight", "squad_walk"];

/** The template's example blog posts (apps/web/content/blog/<locale>/<slug>.mdx). */
export const EXAMPLE_BLOG_POSTS = ["photo-tips", "how-to-make-duo-dance"];

export const VIDEO_CONFIG_FILE = "packages/app-config/src/video.ts";
const BLOG_DIR = "apps/web/content/blog";

/** SHA-256 of a brand file's bytes; `name` ending in .svg or .tsx hashes it with LF line ends. */
export function sha256Of(bytes, name = "") {
  let content = Buffer.from(bytes);
  if (/\.(?:svg|tsx)$/.test(name)) {
    content = Buffer.from(content.toString("utf8").replace(/\r\n/g, "\n"));
  }
  return createHash("sha256").update(content).digest("hex");
}

export function sha256(path) {
  return sha256Of(readFileSync(path), path);
}

/** VIDEO_TEMPLATE_IDS as written in video.ts (empty when the file is missing). */
export function readVideoTemplateIds(root) {
  const file = join(root, VIDEO_CONFIG_FILE);
  if (!existsSync(file)) return [];
  const list =
    /export const VIDEO_TEMPLATE_IDS\s*=\s*\[([^\]]*)\]/.exec(readFileSync(file, "utf8"))?.[1] ??
    "";
  return [...list.matchAll(/["']([a-z0-9_]+)["']/g)].map(([, id]) => id);
}

/**
 * What is still the template's own under `root`: { brandAssets, exampleTemplates, examplePosts }.
 * brandAssets are { path, note? } entries, exampleTemplates ids, examplePosts file paths.
 */
export function templateDefaults(root) {
  const brandAssets = TEMPLATE_BRAND_ASSETS.filter(({ path, sha256: hashes }) => {
    const file = join(root, path);
    return existsSync(file) && hashes.includes(sha256(file));
  }).map(({ path, note }) => ({ path, note }));

  const ids = readVideoTemplateIds(root);
  const exampleTemplates = EXAMPLE_TEMPLATE_IDS.filter((id) => ids.includes(id));

  const examplePosts = [];
  const blogDir = join(root, BLOG_DIR);
  const locales = existsSync(blogDir)
    ? readdirSync(blogDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
  for (const locale of locales) {
    for (const slug of EXAMPLE_BLOG_POSTS) {
      const path = `${BLOG_DIR}/${locale}/${slug}.mdx`;
      if (existsSync(join(root, path))) examplePosts.push(path);
    }
  }
  return { brandAssets, exampleTemplates, examplePosts };
}

/** The gate's report lines for templateDefaults(); empty when nothing is left. */
export function templateDefaultsReport({ brandAssets, exampleTemplates, examplePosts }) {
  const lines = [];
  if (brandAssets.length) {
    lines.push("• Brand files still the template's own; replace them with yours:");
    for (const { path, note } of brandAssets) lines.push(`    ${path}${note ? ` (${note})` : ""}`);
  }
  if (exampleTemplates.length) {
    lines.push(
      `• Example video templates still in VIDEO_TEMPLATE_IDS (${VIDEO_CONFIG_FILE}); add your own and delete these:`,
      `    ${exampleTemplates.join(", ")}`,
      "    from video.ts, apps/server/src/video/templates.ts, apps/web/src/lib/video/templates.ts,",
      "    packages/i18n/src/messages/web/en.json video.templates.<id> and",
      "    apps/web/public/templates/<id>/ (SETUP.zh-CN.md § 0)",
    );
  }
  if (examplePosts.length) {
    lines.push("• Example blog posts; delete them or replace them with your own:");
    for (const path of examplePosts) lines.push(`    ${path}`);
  }
  return lines;
}
