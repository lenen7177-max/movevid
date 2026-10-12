import { createFileRoute } from "@tanstack/react-router";
import { webConfig } from "@/configs/web-config";

/** /robots.txt, pointing crawlers at the sitemap on this deployment's own domain. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            "Disallow: /rpc/",
            "",
            `Sitemap: ${webConfig.AppUrl.replace(/\/$/, "")}/sitemap.xml`,
            "",
          ].join("\n"),
          {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "public, max-age=86400",
            },
          },
        ),
    },
  },
});
