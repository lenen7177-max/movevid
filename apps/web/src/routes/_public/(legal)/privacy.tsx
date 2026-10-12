import { createFileRoute } from "@tanstack/react-router";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, useLocale, useTranslations } from "@/i18n";
import { formatEffectiveDate } from "@/utils/date";
import { buildSeoHead } from "@/utils/seo";
import { LegalProse } from "@/components/legal/legal-prose";

export const Route = createFileRoute("/_public/(legal)/privacy")({
  head: () => {
    const locale = getCurrentLocale();
    const messages = getMessages(locale);
    const title = `${messages.legal.privacy.title} | ${webConfig.AppName}`;

    return buildSeoHead({
      locale,
      title,
      description: messages.legal.privacy.description.replace("{appName}", webConfig.AppName),
      canonicalPath: "/privacy",
      type: "article",
      siteName: webConfig.AppName,
    });
  },
  component: RouteComponent,
});

const privacySectionKeys = [
  "whoWeAre",
  "informationCollect",
  "howWeUse",
  "photosAndVideos",
  "informationSharing",
  "dataRetention",
  "security",
  "cookies",
  "yourRights",
  "children",
  "contactUs",
] as const;

function RouteComponent() {
  const t = useTranslations("legal.privacy");
  const commonT = useTranslations("legal.common");
  const locale = useLocale();
  const formattedDate = formatEffectiveDate(locale, commonT("effectiveDate"));
  const legalValues = { appName: webConfig.AppName, supportEmail: webConfig.SupportEmail };

  return (
    <main className="pt-32 pb-20">
      <div className="container mx-auto px-4">
        <article className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-3 border-b pb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
            <p className="text-muted-foreground leading-7">{t("description", legalValues)}</p>
            <p className="text-sm text-muted-foreground">
              {commonT("lastUpdatedLabel")}: {formattedDate}
            </p>
          </header>

          <div className="space-y-8">
            {privacySectionKeys.map((sectionKey) => (
              <section key={sectionKey} className="space-y-2">
                <h2 className="text-xl font-semibold">{t(`sections.${sectionKey}.title`)}</h2>
                <LegalProse content={t(`sections.${sectionKey}.content`, legalValues)} />
              </section>
            ))}
          </div>

          <footer className="border-t pt-6 text-sm text-muted-foreground">
            {commonT("contactLabel")}: {webConfig.SupportEmail}
          </footer>
        </article>
      </div>
    </main>
  );
}
