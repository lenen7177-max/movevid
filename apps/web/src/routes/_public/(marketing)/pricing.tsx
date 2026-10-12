import { createFileRoute } from "@tanstack/react-router";
import { fillPricingValues, PricingPage } from "@/components/video/pricing-page";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
import { getVideoPricing } from "@/lib/video/pricing";
import { buildSeoHead } from "@/utils/seo";

const usd = (cents: number) => (cents / 100).toFixed(2);

export const Route = createFileRoute("/_public/(marketing)/pricing")({
  head: () => {
    const locale = getCurrentLocale();
    const { pricing: copy } = getMessages(locale).video;
    const pricing = getVideoPricing();
    const description = fillPricingValues(copy.seo.description);

    return buildSeoHead({
      locale,
      title: copy.seo.title,
      description,
      canonicalPath: "/pricing",
      type: "website",
      siteName: webConfig.AppName,
      ldJson: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: copy.seo.title,
            description,
            inLanguage: locale,
          },
          {
            "@type": "WebApplication",
            name: webConfig.AppName,
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            offers: pricing.packs.map((pack) => ({
              "@type": "Offer",
              name: `${pack.credits} credits`,
              price: usd(pack.amountCents),
              priceCurrency: "USD",
            })),
          },
          {
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: copy.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: fillPricingValues(item.a),
              },
            })),
          },
        ],
      },
    });
  },
  component: PricingPage,
});
