import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
import { VIDEO_TEMPLATE_IDS } from "../../packages/app-config/src/video";
import * as MdxConfig from "./source.config";
import { templateSlug } from "./src/lib/video/slug";

// Every bundled template gets its own landing page at /templates/<slug>.
const templatePages = VIDEO_TEMPLATE_IDS.map((id) => `/templates/${templateSlug(id)}`);

const blogPages = (() => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "content/blog/en");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => `/blog/${name.replace(/\.mdx$/, "")}`);
})();

const localeNeutralPublicPages = [
  "/",
  "/studio",
  "/templates",
  "/pricing",
  "/privacy",
  "/terms",
  "/blog",
  ...templatePages,
  ...blogPages,
];

// URL prefix, content folder and hreflang code for each locale.
const sitemapLocales = [
  { prefix: "", dir: "en", hreflang: "en" },
  { prefix: "/zh", dir: "zh", hreflang: "zh" },
  { prefix: "/jp", dir: "jp", hreflang: "ja" },
] as const;

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

const appDirectory = dirname(fileURLToPath(import.meta.url));

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

/** Maps each public URL path to its route file, from the createFileRoute ids. */
function buildRouteFileMap(): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      const id = readFileSync(file, "utf8").match(/createFileRoute\("([^"]+)"\)/)?.[1];
      // Skip pathless layouts (e.g. "/_public", "/_public/(marketing)"); index routes end in "/".
      const last = id?.split("/").at(-1) ?? "";
      if (!id || (!id.endsWith("/") && (last.startsWith("_") || /^\(.*\)$/.test(last)))) {
        continue;
      }
      const segments = id
        .split("/")
        .filter((segment) => segment && !segment.startsWith("_") && !/^\(.*\)$/.test(segment));
      map.set(`/${segments.join("/")}`.replace(/\/$/, "") || "/", file);
    }
  };
  walk(resolve(appDirectory, "src/routes"));
  return map;
}

/**
 * When a page's own content last changed: blog posts use their MDX file; other pages use
 * their route file plus the landing components it imports. Shared files (messages, layout)
 * are left out, since they change with every release and would mark every page as new.
 */
function resolveLastModified(path: string, localeDir: string, routeFiles: Map<string, string>) {
  const files: string[] = [];
  const blogDir = resolve(appDirectory, "content/blog", localeDir);
  if (path === "/blog") {
    if (existsSync(blogDir)) {
      files.push(...readdirSync(blogDir).map((name) => join(blogDir, name)));
    }
  } else if (path.startsWith("/blog/")) {
    files.push(join(blogDir, `${path.slice("/blog/".length)}.mdx`));
  } else {
    const routeFile = routeFiles.get(path);
    if (routeFile) {
      files.push(routeFile);
      const source = readFileSync(routeFile, "utf8");
      for (const [, name] of source.matchAll(/from "@\/components\/video\/([\w-]+)"/g)) {
        files.push(resolve(appDirectory, "src/components/video", `${name}.tsx`));
      }
    }
  }
  const times = files.filter((file) => existsSync(file)).map((file) => statSync(file).mtimeMs);
  return times.length ? new Date(Math.max(...times)) : undefined;
}

/** Sitemap entries for every locale, with real last-modified dates and hreflang alternates. */
function buildPublicPageEntries(host: string | undefined) {
  const routeFiles = buildRouteFileMap();
  return sitemapLocales.flatMap(({ prefix, dir }) =>
    localeNeutralPublicPages.map((path) => {
      const alternateRefs = host
        ? [
            ...sitemapLocales.map((locale) => ({
              href: `${host}${localizedPath(locale.prefix, path)}`,
              hreflang: locale.hreflang,
            })),
            { href: `${host}${path}`, hreflang: "x-default" },
          ]
        : undefined;
      return {
        path: localizedPath(prefix, path),
        prerender: { crawlLinks: false },
        sitemap: { lastmod: resolveLastModified(path, dir, routeFiles), alternateRefs },
      };
    }),
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appDirectory, "");
  const wranglerVars = loadWranglerVars();
  const pwaBuildId = `${process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local"}-${Date.now().toString(36)}`;
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
