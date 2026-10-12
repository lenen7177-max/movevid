import { createFileRoute } from "@tanstack/react-router";
import { HOME_FAQ_KEYS, HomePage } from "@/components/marketing/home-page";
import { fillPricingValues } from "@/components/video/pricing-page";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
import { buildSeoHead } from "@/utils/seo";

export const Route = createFileRoute("/_public/(marketing)/(landing-page)/")({
  head: () => {
    const locale = getCurrentLocale();
    const { seo, home } = getMessages(locale).video;

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
          {
            "@type": "WebApplication",
            name: webConfig.AppName,
            description: seo.home.description,
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            publisher: { "@type": "Organization", name: webConfig.AppName },
          },
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
  component: HomePage,
});
