import { SINGLE_TEMPLATE_ID } from "@repo/app-config/video";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { buttonVariants } from "@repo/ui/button";
import { Wand2 } from "lucide-react";
import { TemplateGallery } from "@/components/video/template-gallery";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, useTranslations } from "@/i18n";
import { templatesNewestFirst } from "@/lib/video/template-catalog";
import { templatePath } from "@/lib/video/templates";
import { buildSeoHead } from "@/utils/seo";

export const Route = createFileRoute("/_public/(marketing)/templates/")({
  // With a single template there is nothing to browse: its landing page is the home page.
  beforeLoad: () => {
    if (SINGLE_TEMPLATE_ID) throw redirect({ to: "/", statusCode: 301 });
  },
  head: () => {
    const locale = getCurrentLocale();
    const { gallery, templates } = getMessages(locale).video;
    const ids = templatesNewestFirst();

    return buildSeoHead({
      locale,
      title: gallery.seo.title,
      description: gallery.seo.description,
      keywords: gallery.seo.keywords,
      canonicalPath: "/templates",
      type: "website",
      siteName: webConfig.AppName,
      ldJson: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: gallery.title,
            description: gallery.seo.description,
            inLanguage: locale,
          },
          {
            "@type": "ItemList",
            name: gallery.title,
            numberOfItems: ids.length,
            itemListElement: ids.map((id, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: templates[id].name,
              url: `${webConfig.AppUrl}${templatePath(id)}`,
            })),
          },
        ],
      },
    });
  },
  component: TemplatesPage,
});

function TemplatesPage() {
  const t = useTranslations("video.gallery");
  const count = templatesNewestFirst().length;

  return (
    <main>
      <section className="hero-glow pt-32 pb-20 sm:pt-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow">{t("eyebrow", { count })}</p>
            <h1 className="display mt-4 text-5xl sm:text-6xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-5 text-lg text-balance">{t("subtitle")}</p>
          </div>
          <TemplateGallery />
        </div>
      </section>
      <section className="px-4 pb-24 sm:px-6">
        <div className="bg-card mx-auto max-w-5xl rounded-[2rem] border px-6 py-16 text-center">
          <h2 className="display text-3xl sm:text-4xl">{t("ctaTitle")}</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-balance">{t("ctaBody")}</p>
          <Link
            to="/studio"
            className={buttonVariants({ size: "lg", className: "mt-8 h-11 rounded-full px-6" })}
          >
            <Wand2 aria-hidden="true" />
            {t("ctaButton")}
          </Link>
        </div>
      </section>
    </main>
  );
}
