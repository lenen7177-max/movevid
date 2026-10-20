import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { parse } from "jsonc-parser";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import {
  SINGLE_TEMPLATE_ID,
  VIDEO_TEMPLATE_IDS,
  latestVideoTemplateLaunchDate,
  videoTemplates,
} from "../../packages/app-config/src/video";
import { defaultLocale, localeToHreflang, supportedLocales } from "../../packages/i18n/src/locales";
import * as MdxConfig from "./source.config";
import { templateSlug } from "./src/lib/video/slug";

const appDirectory = dirname(fileURLToPath(import.meta.url));

// One id per build: this config is loaded more than once per `vite build` (TanStack Start runs
// nested builds), and the bundles and dist/.build-id must agree, so the first load pins it.
const pwaBuildId =
  (process.env.PWA_BUILD_ID ??= `${process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local"}-${Date.now().toString(36)}`);

// Every bundled template gets its own landing page at /templates/<slug>. With a single
// template the home page is its landing page instead, so /templates/* is left out.
const templatePages = SINGLE_TEMPLATE_ID
  ? []
  : ["/templates", ...VIDEO_TEMPLATE_IDS.map((id) => `/templates/${templateSlug(id)}`)];

const blogPages = (() => {
  const dir = resolve(appDirectory, "content/blog", defaultLocale);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => `/blog/${name.replace(/\.mdx$/, "")}`);
})();

const localeNeutralPublicPages = [
  "/",
  "/studio",
  "/pricing",
  "/privacy",
  "/terms",
  "/blog",
  ...templatePages,
  ...blogPages,
];

// URL prefix, content folder and hreflang code for each served locale (English only by default).
const sitemapLocales = supportedLocales.map((locale) => ({
  prefix: locale === defaultLocale ? "" : `/${locale}`,
  dir: locale,
  hreflang: localeToHreflang[locale],
}));

function localizedPath(prefix: string, path: string): string {
  return prefix && path === "/" ? prefix : `${prefix}${path}`;
}

const devOptimizeDeps = ["@unpic/react"];

const nonPublicPrefixes = [
  "/auth",
  "/billing",
  "/credits",
  "/dashboard",
  "/settings",
  "/users",
  "/api",
  "/rpc",
];

function isPrerenderablePath(path: string): boolean {
  if (path.includes("#")) {
    return false;
  }

  const normalizedPath = (path.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";

  return !nonPublicPrefixes.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
}

function loadWranglerVars(): Record<string, string> {
  const config = parse(readFileSync(resolve(appDirectory, "wrangler.jsonc"), "utf8")) as {
    vars?: Record<string, string>;
  };

  return config.vars ?? {};
}

function resolveBuildEnvValue(
  key: string,
  sources: ReadonlyArray<Record<string, string | undefined>>,
): string | undefined {
  for (const source of sources) {
    const value = source[key];
    if (value) {
      return value;
    }
  }
}

function getWranglerViteEnvDefines(
  mode: string,
  env: Record<string, string>,
  wranglerVars: Record<string, string>,
) {
  if (mode !== "production") {
    return {};
  }

  const defines: Record<string, string> = {};

  for (const [key, value] of Object.entries(wranglerVars)) {
    if (!key.startsWith("VITE_") || !value) {
      continue;
    }

    if (process.env[key] || env[key]) {
      continue;
    }

    defines[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return defines;
}

/** `date:` from a blog post's frontmatter (YYYY-MM-DD, checked by `pnpm blog:validate`). */
function blogPostDate(localeDir: string, slug: string): string | undefined {
  const file = join(appDirectory, "content/blog", localeDir, `${slug}.mdx`);
  if (!existsSync(file)) return undefined;
  return /^date:\s*["']?([\d-]+)/m.exec(readFileSync(file, "utf8"))?.[1];
}

/**
 * When a page's own content last changed, from fixed dates rather than the build: template
 * pages use the template's launchDate, blog posts their frontmatter date and the blog index the
 * newest post. Every other page uses the newest template's launchDate. TanStack Start writes
 * the build date for pages without one, and a date that moves on every deploy teaches search
 * engines to ignore <lastmod> for the whole site.
 */
function resolveLastModified(path: string, localeDir: string): Date {
  const templateId = VIDEO_TEMPLATE_IDS.find((id) => path === `/templates/${templateSlug(id)}`);
  let day: string | undefined;
  if (templateId) {
    day = videoTemplates[templateId].launchDate;
  } else if (path.startsWith("/blog/")) {
    day = blogPostDate(localeDir, path.slice("/blog/".length));
  } else if (path === "/blog") {
    day = blogPages
      .map((page) => blogPostDate(localeDir, page.slice("/blog/".length)) ?? "")
      .sort()
      .at(-1);
  }
  return new Date(`${day || latestVideoTemplateLaunchDate()}T00:00:00Z`);
}

/** Sitemap entries for every served locale, with fixed last-modified dates and hreflang. */
function buildPublicPageEntries(host: string | undefined) {
  return sitemapLocales.flatMap(({ prefix, dir }) =>
    localeNeutralPublicPages.map((path) => {
      const alternateRefs = host
        ? [
            ...sitemapLocales.map((locale) => ({
              href: `${host}${localizedPath(locale.prefix, path)}`,
              hreflang: locale.hreflang,
            })),
            // x-default only means something when there is more than one language.
            ...(sitemapLocales.length > 1
              ? [{ href: `${host}${path}`, hreflang: "x-default" }]
              : []),
          ]
        : undefined;
      return {
        path: localizedPath(prefix, path),
        prerender: { crawlLinks: false },
        sitemap: { lastmod: resolveLastModified(path, dir), alternateRefs },
      };
    }),
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appDirectory, "");
  const wranglerVars = loadWranglerVars();
  const sitemapHost = resolveBuildEnvValue("VITE_APP_URL", [
    process.env,
    env,
    wranglerVars,
  ])?.replace(/\/+$/, "");

  // development: .env, .env.local, .env.development, .env.development.local
  // production: .env, .env.local, .env.production, .env.production.local
  return {
    define: {
      __PWA_BUILD_ID__: JSON.stringify(pwaBuildId),
      ...getWranglerViteEnvDefines(mode, env, wranglerVars),
    },
    server: {
      port: 3000,
    },
    optimizeDeps: {
      include: devOptimizeDeps,
    },
    plugins: [
      ...(mode === "development" ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
      {
        // dist/.build-id lets scripts/indexnow.mjs wait until /api/pwa-version serves this build.
        name: "write-build-id",
        apply: "build",
        closeBundle() {
          mkdirSync(resolve(appDirectory, "dist"), { recursive: true });
          writeFileSync(resolve(appDirectory, "dist/.build-id"), pwaBuildId);
        },
      },
      // DEVTOOLS_PORT moves the devtools event bus off 42069 when another project uses it.
      devtools({ eventBusConfig: { port: Number(process.env.DEVTOOLS_PORT) || 42069 } }),
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({
        srcDirectory: "src",
        pages: buildPublicPageEntries(sitemapHost),
        prerender: {
          enabled: false,
          crawlLinks: true,
          autoStaticPathsDiscovery: false,
          filter: (page) => {
            const isPublicPath = isPrerenderablePath(page.path);
            if (!isPublicPath) {
              page.sitemap = {
                ...page.sitemap,
                exclude: true,
              };
            }
            return isPublicPath;
          },
        },
        sitemap: {
          enabled: true,
          host: sitemapHost,
        },
      }),
      viteReact({
        // https://react.dev/learn/react-compiler
        babel: {
          plugins: [
            [
              "babel-plugin-react-compiler",
              {
                target: "19",
              },
            ],
          ],
        },
      }),
      mdx(MdxConfig),
    ],
    ssr: {
      optimizeDeps: {
        include: devOptimizeDeps,
      },
    },
  };
});
