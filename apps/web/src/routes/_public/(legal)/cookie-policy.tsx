import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal/legal-document";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, useLocale, useTranslations } from "@/i18n";
import { formatEffectiveDate } from "@/utils/date";
import { buildSeoHead } from "@/utils/seo";

const values = { appName: webConfig.AppName, supportEmail: webConfig.SupportEmail };

export const Route = createFileRoute("/_public/(legal)/cookie-policy")({
  head: () => {
    const locale = getCurrentLocale();
    const copy = getMessages(locale).legal.cookies;

    return buildSeoHead({
      locale,
      title: `${copy.title.replace("{appName}", webConfig.AppName)} | ${webConfig.AppName}`,
      description: copy.description.replace("{appName}", webConfig.AppName),
      canonicalPath: "/cookie-policy",
      type: "article",
      siteName: webConfig.AppName,
    });
  },
  component: RouteComponent,
});

const sectionKeys = [
  "overview",
  "essential",
  "onDevice",
  "analytics",
  "payments",
  "choices",
  "contactUs",
] as const;

function RouteComponent() {
  const t = useTranslations("legal.cookies");
  const commonT = useTranslations("legal.common");
  const locale = useLocale();
  const updated = `${commonT("lastUpdatedLabel")}: ${formatEffectiveDate(locale, t("effectiveDate"))}`;
  return (
    <LegalDocument
      title={t("title", values)}
      description={t("description", values)}
      updated={updated}
      sections={sectionKeys.map((key) => ({
        key,
        title: t(`sections.${key}.title`, values),
        content: t(`sections.${key}.content`, values),
      }))}
      footer={`${commonT("contactLabel")}: ${webConfig.SupportEmail}`}
    />
  );
}
