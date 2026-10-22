import {
  VIDEO_QUALITIES,
  type VideoTemplateId,
  getVideoCreditsCost,
  getVideoMinPhotos,
  getVideoRenderSeconds,
  getVideoTemplateModels,
  isVideoModelQuality,
  videoConfig,
  videoTemplates,
} from "@repo/app-config/video";
import { createFileRoute } from "@tanstack/react-router";
import { FAQ_UPDATED_AT, HOME_FAQ_KEYS } from "@/components/marketing/home-page";
import { fillPricingValues } from "@/components/video/pricing-page";
import { MODEL_TIER } from "@/components/video/studio-creator";
import { webConfig } from "@/configs/web-config";
import { getMessages } from "@/i18n";
import { getVideoPricing } from "@/lib/video/pricing";
import { templatesNewestFirst } from "@/lib/video/template-catalog";
import { templatePath } from "@/lib/video/templates";

const TIER_LABEL = { premium: "Premium", fast: "Fast" } as const;

/** Credits for every version and quality of one template, as a Markdown table. */
function priceTable(templateId: VideoTemplateId): string[] {
  return [
    `| Version | Length | ${VIDEO_QUALITIES.join(" | ")} |`,
    `|---|---|${VIDEO_QUALITIES.map(() => "---").join("|")}|`,
    ...getVideoTemplateModels(templateId).map((model) => {
      const cells = VIDEO_QUALITIES.map((quality) =>
        isVideoModelQuality(model, quality)
          ? `${getVideoCreditsCost(quality, templateId, model)} credits`
          : "—",
      );
      const seconds = getVideoRenderSeconds(templateId, model);
      return `| ${TIER_LABEL[MODEL_TIER[model]]} | ${seconds} s | ${cells.join(" | ")} |`;
    }),
  ];
}

/** One template's section: its page, what it makes, the photos it takes and its prices. */
function templateSection(templateId: VideoTemplateId): string[] {
  const { video } = getMessages("en");
  const copy = video.templates[templateId];
  const template = videoTemplates[templateId];
  // Our template copy also carries nested blocks (trend, faq); only the *Role strings are read.
  const roles = copy as unknown as Record<string, unknown>;
  const roleName = (slot: string) => {
    const role = roles[`${slot}Role`];
    return typeof role === "string" ? role : slot;
  };
  const minPhotos = getVideoMinPhotos(templateId);
  const photos =
    minPhotos < template.slots.length
      ? `${minPhotos}–${template.slots.length}`
      : String(template.slots.length);

  return [
    `### ${copy.name}`,
    "",
    `Page: ${webConfig.AppUrl}${templatePath(templateId)}`,
    "",
    copy.description,
    "",
    `- Photos: ${photos} (${template.slots.map(roleName).join(", ")})`,
    `- Format: ${template.aspectRatio} MP4, about ${template.durationSeconds} s${template.soundtrack ? ", with music" : ""}`,
    "",
    ...priceTable(templateId),
    "",
  ];
}

/**
 * /llms-full.txt: the whole product in one plain-text file for AI assistants — what it does,
 * every template and price, and the FAQ — built from the same config and English copy as the
 * pages, so it never drifts from them. /llms.txt is the short map.
 */
async function buildLlmsFullTxt(): Promise<string> {
  const { video } = getMessages("en");
  const site = webConfig.AppUrl;
  const packs = getVideoPricing().packs;
  const firstFull = videoConfig.firstFullCredits;
  const faq = HOME_FAQ_KEYS.flatMap((key) => [
    `### ${video.home.faq.items[key].q}`,
    "",
    fillPricingValues(video.home.faq.items[key].a),
    "",
  ]);

  return [
    `# ${webConfig.AppName}`,
    "",
    `> ${video.seo.home.description}`,
    "",
    `Website: ${site} · Last updated: ${FAQ_UPDATED_AT} · Contact: ${webConfig.SupportEmail}`,
    "",
    "## How it works",
    "",
    "1. Open a template and add the photos it asks for (one person per photo, face clearly visible).",
    "2. Pick a version and quality. Fast is cheaper and renders up to 15 s; Premium renders the full video, up to 1080p.",
    "3. Photos go through the video provider's review, then the video renders in a few minutes.",
    "4. Download the MP4 or share it. Failed renders and rejected photos refund their credits automatically.",
    "",
    "## Templates",
    "",
    ...templatesNewestFirst().flatMap(templateSection),
    `Every template with its sample video: ${site}/examples`,
    "",
    "## Pricing",
    "",
    "One-time credit packs (no subscription; purchased credits don't expire):",
    "",
    ...packs.map((pack) => `- ${pack.credits} credits: $${(pack.amountCents / 100).toFixed(2)}`),
    "",
    ...(firstFull != null
      ? [`An account's first full Premium video at 480p costs at most ${firstFull} credits.`, ""]
      : []),
    "## FAQ",
    "",
    ...faq,
    "## Policies",
    "",
    "- Uploaded photos and generated videos are private: they are never published, shown to other users or used in examples or marketing.",
    "- Only use photos of yourself or people who agreed to appear; photos of public figures are rejected.",
    `- [Privacy policy](${site}/privacy) · [Terms of service](${site}/terms) · [Refund policy](${site}/refund-policy) · [Cookie policy](${site}/cookie-policy)`,
    `- [About](${site}/about) · [Contact](${site}/contact)`,
    "",
  ].join("\n");
}

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(await buildLlmsFullTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
