import { SINGLE_TEMPLATE_ID } from "@repo/app-config/video";
import { createFileRoute } from "@tanstack/react-router";
import { HOME_FAQ_KEYS, HomePage } from "@/components/marketing/home-page";
import { fillPricingValues } from "@/components/video/pricing-page";
import { TemplatePage } from "@/components/video/template-page";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
import { organizationId, organizationLd, webSiteLd } from "@/lib/seo/site-ld";
import { fetchTemplateGuide } from "@/lib/video/template-guide";
import { buildTemplateHead } from "@/lib/video/template-seo";
import { buildSeoHead } from "@/utils/seo";

function webApplicationLd(description: string, locale: string) {
  return {
    "@type": "WebApplication",
    name: webConfig.AppName,
    description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    inLanguage: locale,
    publisher: { "@id": organizationId() },
  };
}

export const Route = createFileRoute("/_public/(marketing)/(landing-page)/")({
  // A single-template home page links to that template's how-to guide.
  loader: async () => ({
    guide: SINGLE_TEMPLATE_ID
      ? await fetchTemplateGuide({
          data: { templateId: SINGLE_TEMPLATE_ID, locale: getCurrentLocale() },
        })
      : null,
  }),
  head: () => {
    const locale = getCurrentLocale();
    const { seo, home, templates } = getMessages(locale).video;

    // Single-template site: the home page is that template's landing page, so its title and
    // H1 lead with the template's keyword and /templates/<slug> redirects here.
    if (SINGLE_TEMPLATE_ID) {
      // buildTemplateHead adds the Organization node itself.
      return buildTemplateHead(SINGLE_TEMPLATE_ID, [
        webSiteLd(locale),
        webApplicationLd(templates[SINGLE_TEMPLATE_ID].description, locale),
      ]);
    }

    return buildSeoHead({
      locale,
      title: seo.home.title,
      description: seo.home.description,
      keywords: seo.home.keywords,
      canonicalPath: "/",
      type: "website",
      siteName: webConfig.AppName,
      ldJson: {
        "@context": "https://schema.org",
        "@graph": [
          organizationLd(),
          webSiteLd(locale),
          webApplicationLd(seo.home.description, locale),
          {
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: HOME_FAQ_KEYS.map((key) => ({
              "@type": "Question",
              name: home.faq.items[key].q,
              acceptedAnswer: {
                "@type": "Answer",
                text: fillPricingValues(home.faq.items[key].a),
              },
            })),
          },
        ],
      },
    });
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { guide } = Route.useLoaderData();
  return SINGLE_TEMPLATE_ID ? (
    <TemplatePage templateId={SINGLE_TEMPLATE_ID} guide={guide} />
  ) : (
    <HomePage />
  );
}
