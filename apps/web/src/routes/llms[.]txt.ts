import { videoTemplates, getVideoMinPhotos } from "@repo/app-config/video";
import { createFileRoute } from "@tanstack/react-router";
import { webConfig } from "@/configs/web-config";
import { getMessages } from "@/i18n";
import { getVideoPricing } from "@/lib/video/pricing";
import { templateFromCredits, templatesNewestFirst } from "@/lib/video/template-catalog";
import { templatePath } from "@/lib/video/templates";

/**
 * /llms.txt (https://llmstxt.org): a plain-text map of the site for AI assistants, built from
 * the same template config and English copy as the pages, so prices and templates stay in sync.
 */
async function buildLlmsTxt(): Promise<string> {
  const { video } = getMessages("en");
  const site = webConfig.AppUrl;

  const templates = templatesNewestFirst().map((id) => {
    const template = videoTemplates[id];
    const minPhotos = getVideoMinPhotos(id);
    // Widened to number: with one template left, the slot count is a literal type.
    const slots: number = template.slots.length;
    const photos =
      minPhotos < slots
        ? `${minPhotos}–${slots} photos`
        : `${slots} photo${slots === 1 ? "" : "s"}`;
    return [
      `- [${video.templates[id].name}](${site}${templatePath(id)}): ${video.templates[id].tagline}`,
      `  Photos: ${photos}. Length: about ${template.durationSeconds} s. Format: ${template.aspectRatio} MP4. From ${templateFromCredits(id)} credits.`,
    ].join("\n");
  });

  const { getPublishedBlogPages, sortBlogPagesByDateDesc } = await import("@/lib/blog-source");
  const guides = sortBlogPagesByDateDesc(getPublishedBlogPages("en")).map(
    (page) =>
      `- [${page.data.title}](${site}/blog/${page.slugs.join("/")})${page.data.description ? `: ${page.data.description}` : ""}`,
  );
  const fromPrice = ((getVideoPricing().packs[0]?.amountCents ?? 0) / 100).toFixed(2);

  return [
    `# ${webConfig.AppName}`,
    "",
    `> ${video.seo.home.description}`,
    "",
    `Website: ${site}`,
    "",
    "## How it works",
    "",
    "1. Open a template and add the photos it asks for (one person per photo, face clearly visible).",
    "2. Pick a version and quality (480p, 720p or 1080p). Photos are reviewed, then the video renders in a few minutes.",
    "3. Download the MP4 or share it. Failed renders refund their credits automatically.",
    "",
    "## Templates",
    "",
    ...templates,
    "",
    "## Pricing",
    "",
    `- [Credit packs](${site}/pricing): one-time packs from $${fromPrice}. Failed renders are refunded automatically.`,
    ...(guides.length ? ["", "## Guides", "", ...guides] : []),
    "",
    "## Privacy and policies",
    "",
    "- Uploaded photos and generated videos are private to the account that made them.",
    "- Only use photos of yourself or people who agreed to appear; photos of public figures are rejected.",
    `- [Privacy policy](${site}/privacy) · [Terms of service](${site}/terms)`,
    "",
  ].join("\n");
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(await buildLlmsTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
