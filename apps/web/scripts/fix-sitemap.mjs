// TanStack Start writes the sitemap namespace as https://www.sitemaps.org/...,
// but the protocol requires http://www.sitemaps.org/schemas/sitemap/0.9.
// Search engines ignore every <url> under the wrong namespace, so fix it after each build.
import { readFile, writeFile } from "node:fs/promises";

const sitemapPath = new URL("../dist/client/sitemap.xml", import.meta.url);
const WRONG_NAMESPACE = 'xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"';
const SITEMAP_NAMESPACE = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

let xml;
try {
  xml = await readFile(sitemapPath, "utf8");
} catch {
  process.exit(0);
}

if (xml.includes(WRONG_NAMESPACE)) {
  await writeFile(sitemapPath, xml.replace(WRONG_NAMESPACE, SITEMAP_NAMESPACE));
  process.stdout.write("[sitemap] fixed xmlns to http://www.sitemaps.org/schemas/sitemap/0.9\n");
}
