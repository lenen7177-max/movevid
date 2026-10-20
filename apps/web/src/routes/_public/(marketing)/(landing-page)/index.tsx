import { SINGLE_TEMPLATE_ID } from "@repo/app-config/video";
import { createFileRoute } from "@tanstack/react-router";
import { HOME_FAQ_KEYS, HomePage } from "@/components/marketing/home-page";
import { fillPricingValues } from "@/components/video/pricing-page";
import { TemplatePage } from "@/components/video/template-page";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
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
    publisher: { "@type": "Organization", name: webConfig.AppName },
  };
}

export const Route = createFileRoute("/_public/(marketing)/(landing-page)/")({
  head: () => {
    const locale = getCurrentLocale();
    const { seo, home, templates } = getMessages(locale).video;

    // Single-template site: the home page is that template's landing page, so its title and
    // H1 lead with the template's keyword and /templates/<slug> redirects here.
    if (SINGLE_TEMPLATE_ID) {
      return buildTemplateHead(SINGLE_TEMPLATE_ID, [
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
  return SINGLE_TEMPLATE_ID ? <TemplatePage templateId={SINGLE_TEMPLATE_ID} /> : <HomePage />;
}
