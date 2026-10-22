import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal/legal-document";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, useTranslations } from "@/i18n";
import { buildSeoHead } from "@/utils/seo";

const values = { appName: webConfig.AppName, supportEmail: webConfig.SupportEmail };

export const Route = createFileRoute("/_public/(marketing)/about")({
  head: () => {
    const locale = getCurrentLocale();
    const copy = getMessages(locale).company.about;

    return buildSeoHead({
      locale,
      title: `${copy.title.replace("{appName}", webConfig.AppName)} | ${webConfig.AppName}`,
      description: copy.description.replace("{appName}", webConfig.AppName),
      canonicalPath: "/about",
      type: "website",
      siteName: webConfig.AppName,
    });
  },
  component: RouteComponent,
});

const sectionKeys = [
  "whatItIs",
  "howItWorks",
  "pricing",
  "privacy",
  "independent",
  "contactUs",
] as const;

function RouteComponent() {
  const t = useTranslations("company.about");
  const commonT = useTranslations("legal.common");

  return (
    <LegalDocument
      title={t("title", values)}
      description={t("description", values)}
      sections={sectionKeys.map((key) => ({
        key,
        title: t(`sections.${key}.title`, values),
        content: t(`sections.${key}.content`, values),
      }))}
      footer={`${commonT("contactLabel")}: ${webConfig.SupportEmail}`}
    />
  );
}
