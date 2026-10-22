import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal/legal-document";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, useTranslations } from "@/i18n";
import { buildSeoHead } from "@/utils/seo";

const values = { appName: webConfig.AppName, supportEmail: webConfig.SupportEmail };

export const Route = createFileRoute("/_public/(marketing)/contact")({
  head: () => {
    const locale = getCurrentLocale();
    const copy = getMessages(locale).company.contact;

    return buildSeoHead({
      locale,
      title: `${copy.title.replace("{appName}", webConfig.AppName)} | ${webConfig.AppName}`,
      description: copy.description.replace("{appName}", webConfig.AppName),
      canonicalPath: "/contact",
      type: "website",
      siteName: webConfig.AppName,
    });
  },
  component: RouteComponent,
});

const sectionKeys = ["email", "orders", "refunds", "privacy"] as const;

function RouteComponent() {
  const t = useTranslations("company.contact");
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
