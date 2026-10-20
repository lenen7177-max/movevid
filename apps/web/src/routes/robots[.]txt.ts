import { createFileRoute } from "@tanstack/react-router";
import { webConfig } from "@/configs/web-config";

/**
 * AI search and training crawlers, named so it is explicit that they are welcome (the `*`
 * group already lets them in). A crawler follows only the most specific group that names it,
 * so each group repeats the API rules.
 */
const AI_CRAWLERS = ["OAI-SearchBot", "PerplexityBot", "ClaudeBot", "GPTBot", "Google-Extended"];

const RULES = ["Allow: /", "Disallow: /api/", "Disallow: /rpc/"];

/** /robots.txt: every crawler may index the site; points them at the sitemap on this domain. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            "User-agent: *",
            ...RULES,
            "",
            ...AI_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, ...RULES, ""]),
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
