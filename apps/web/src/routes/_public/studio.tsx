import { VIDEO_TEMPLATE_IDS, videoConfig } from "@repo/app-config/video";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { VideoStudio, STUDIO_FAQ_KEYS } from "@/components/video/video-studio";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
import { templatePath } from "@/lib/video/templates";
import { buildSeoHead } from "@/utils/seo";

const searchSchema = z.object({
  job: z.string().optional(),
  // Shows the pre-rendered result for the sample photos.
  demo: z.boolean().optional(),
  // Template picked in the studio; landing pages link here with their own.
  template: z.enum(VIDEO_TEMPLATE_IDS).optional(),
});

export const Route = createFileRoute("/_public/studio")({
  validateSearch: searchSchema,
  head: ({ match }) => {
    const locale = getCurrentLocale();
    const { seo, templates, studio } = getMessages(locale).video;
    // A user's own render or the sample preview is not a page to index; the clean /studio is.
    const personal = Boolean(match.search.job || match.search.demo);
    return buildSeoHead({
      locale,
      title: seo.studio.title,
      description: seo.studio.description,
      keywords: seo.studio.keywords,
      canonicalPath: "/studio",
      robots: personal ? "noindex,follow" : undefined,
      type: "website",
      siteName: webConfig.AppName,
      ldJson: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebApplication",
            name: studio.page.title,
            description: seo.studio.description,
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            publisher: { "@type": "Organization", name: webConfig.AppName },
          },
          {
            "@type": "ItemList",
            name: studio.templatesSection.title,
            itemListElement: VIDEO_TEMPLATE_IDS.map((id, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: templates[id].name,
              url: `${webConfig.AppUrl}${templatePath(id)}`,
            })),
          },
          {
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: STUDIO_FAQ_KEYS.map((key) => ({
              "@type": "Question",
              name: studio.faq.items[key].q,
              acceptedAnswer: { "@type": "Answer", text: studio.faq.items[key].a },
            })),
          },
        ],
      },
    });
  },
  component: StudioRoute,
});

function StudioRoute() {
  const { job, demo, template } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <VideoStudio
      jobId={job}
      demo={demo}
      templateId={template ?? videoConfig.defaultTemplateId}
      onTemplateChange={(next) => {
        // Only the ?template= param changes: keep the scroll position instead of jumping to the top.
        void navigate({
          to: "/studio",
          search: { template: next },
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}
