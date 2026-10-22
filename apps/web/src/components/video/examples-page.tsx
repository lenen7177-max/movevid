import { videoTemplates } from "@repo/app-config/video";
import { buttonVariants } from "@repo/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Wand2 } from "lucide-react";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, useTranslations } from "@/i18n";
import {
  templateFromCredits,
  templatePhotoRange,
  templatesNewestFirst,
} from "@/lib/video/template-catalog";
import { sampleRender, templateAspectClass, templateLink } from "@/lib/video/templates";
import { cn } from "@/lib/utils";
import { buildSeoHead } from "@/utils/seo";
import { CaseVideo, TemplateMedia } from "./media";

export function buildExamplesHead() {
  const locale = getCurrentLocale();
  const { seo } = getMessages(locale).video.examples;
  return buildSeoHead({
    locale,
    title: seo.title,
    description: seo.description,
    canonicalPath: "/examples",
    type: "website",
    siteName: webConfig.AppName,
  });
}

/**
 * Every template with what it makes: its sample render when there is one, else its preview.
 * Customers' videos are private and never shown here.
 */
export function ExamplesPage() {
  const t = useTranslations("video.examples");
  const templatesT = useTranslations("video.templates");

  return (
    <main>
      <section className="hero-glow pt-32 pb-20 sm:pt-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="display mt-4 text-5xl sm:text-6xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-5 text-lg text-balance">{t("subtitle")}</p>
          </div>
          <ul className="grid gap-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {templatesNewestFirst().map((templateId) => {
              const sample = sampleRender(templateId);
              const name = templatesT(`${templateId}.name`);
              const { min, max } = templatePhotoRange(templateId);
              return (
                <li key={templateId} className="mx-auto flex w-full max-w-[22rem] flex-col">
                  {sample ? (
                    <CaseVideo
                      src={sample.video}
                      poster={sample.poster}
                      label={name}
                      className={cn("w-full rounded-3xl border", templateAspectClass(templateId))}
                    />
                  ) : (
                    <TemplateMedia
                      templateId={templateId}
                      alt={name}
                      className={cn("w-full rounded-3xl border", templateAspectClass(templateId))}
                    />
                  )}
                  <h2 className="mt-5 text-xl font-semibold">{name}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {templatesT(`${templateId}.tagline`)}
                  </p>
                  <p className="text-muted-foreground mt-2 font-mono text-[11px] tracking-wider uppercase">
                    {t("photos", {
                      photos: min === max ? String(max) : `${min}–${max}`,
                      seconds: videoTemplates[templateId].durationSeconds,
                    })}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {/* Straight into the studio with this template picked. */}
                    <Link
                      to="/studio"
                      search={{ template: templateId }}
                      className={buttonVariants({ size: "sm" })}
                    >
                      {t("useTemplate")}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {t("fromCredits", { credits: templateFromCredits(templateId) })}
                    </span>
                  </div>
                  <Link
                    {...templateLink(templateId)}
                    className="text-muted-foreground hover:text-foreground mt-3 inline-flex w-fit items-center gap-1 text-sm hover:underline"
                  >
                    {t("templatePage")}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <section className="px-4 pb-24 sm:px-6">
        <div className="bg-card mx-auto max-w-5xl rounded-[2rem] border px-6 py-16 text-center">
          <h2 className="display text-3xl sm:text-4xl">{t("private.title")}</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-balance">
            {t("private.body", { appName: webConfig.AppName })}
          </p>
          <Link
            to="/studio"
            className={buttonVariants({ size: "lg", className: "mt-8 h-11 rounded-full px-6" })}
          >
            <Wand2 aria-hidden="true" />
            {t("private.cta")}
          </Link>
        </div>
      </section>
    </main>
  );
}
