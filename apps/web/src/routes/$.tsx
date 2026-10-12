import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFound404 } from "@/components/feedback/404/not-found-404";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale } from "@/i18n";
import { buildNoIndexHead } from "@/utils/seo";

/**
 * Splat route that catches all unmatched paths (e.g., /a/b/c).
 * The loader throws notFound() so the server answers HTTP 404 instead of a 200 page that only
 * looks like one ("soft 404"); this route's own notFoundComponent renders the page inside the
 * normal route tree, keeping styling and hydration (unlike the root notFoundComponent).
 */
export const Route = createFileRoute("/$")({
  head: () =>
    buildNoIndexHead({
      locale: getCurrentLocale(),
      title: `Page Not Found | ${webConfig.AppName}`,
      noIndexPage: "notFound",
      canonicalPath: "/404",
      siteName: webConfig.AppName,
    }),
  loader: () => {
    throw notFound();
  },
  component: NotFound404,
  notFoundComponent: () => <NotFound404 />,
});
