import { VIDEO_TEMPLATE_IDS } from "@repo/app-config/video";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFound404 } from "@/components/feedback/404/not-found-404";
import {
  TEMPLATE_FAQ_KEYS,
  TEMPLATE_STEP_KEYS,
  TemplatePage,
  templateCopyValues,
} from "@/components/video/template-page";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
import { templateIdFromSlug } from "@/lib/video/slug";
import { templateHowToLd, templateVideoGraph } from "@/lib/video/template-seo";
import { templatePath, templatePoster } from "@/lib/video/templates";
import { buildSeoHead } from "@/utils/seo";

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export const Route = createFileRoute("/_public/(marketing)/templates/$slug")({
  loader: ({ params }) => {
    const templateId = templateIdFromSlug(params.slug, VIDEO_TEMPLATE_IDS);
    if (!templateId) throw notFound();
    return { templateId };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { templateId } = loaderData;
    const locale = getCurrentLocale();
    const { templates, templatePage } = getMessages(locale).video;
    const copy = templates[templateId];
    const values = templateCopyValues(templateId);
    const path = templatePath(templateId);

    return buildSeoHead({
      locale,
      title: fill(templatePage.seoTitle, { name: copy.name, appName: webConfig.AppName }),
      description: copy.description,
      keywords: copy.keywords,
      canonicalPath: path,
      image: templatePoster(templateId).endsWith(".svg") ? undefined : templatePoster(templateId),
      type: "website",
      siteName: webConfig.AppName,
      ldJson: {
        "@context": "https://schema.org",
        "@graph": [
          ...templateVideoGraph(templateId, {
            name: copy.name,
            description: copy.description,
            locale,
            uploadDate: new Date().toISOString().slice(0, 10),
          }),
          templateHowToLd({
            name: fill(templatePage.stepsTitle, { name: copy.name }),
            description: copy.description,
            url: path,
            locale,
            steps: TEMPLATE_STEP_KEYS.map((key) => ({
              title: templatePage.steps[key].title,
              body: fill(templatePage.steps[key].body, values),
            })),
          }),
          {
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: TEMPLATE_FAQ_KEYS.map((key) => ({
              "@type": "Question",
              name: templatePage.faq[key].q,
              acceptedAnswer: { "@type": "Answer", text: fill(templatePage.faq[key].a, values) },
            })),
          },
        ],
      },
    });
  },
  component: TemplateRoute,
  notFoundComponent: () => <NotFound404 />,
});

function TemplateRoute() {
  const { templateId } = Route.useLoaderData();
  return <TemplatePage key={templateId} templateId={templateId} />;
}
