import { SINGLE_TEMPLATE_ID } from "@repo/app-config/video";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/logos/brand-logo";
import { webConfig } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { templatesNewestFirst } from "@/lib/video/template-catalog";
import { templatePath } from "@/lib/video/templates";

type FooterLink = { label: string; to: string; hash?: string };

const currentYear = new Date().getFullYear();

const SOCIAL_NAMES: Record<string, string> = {
  "tiktok.com": "TikTok",
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "x.com": "X",
  "twitter.com": "X",
  "facebook.com": "Facebook",
  "linkedin.com": "LinkedIn",
  "threads.net": "Threads",
  "pinterest.com": "Pinterest",
};

/** "TikTok" for https://www.tiktok.com/@brand; the bare host for anything else. */
function socialLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SOCIAL_NAMES[host] ?? host;
  } catch {
    return url;
  }
}

/** Marketing footer: brand, product links, every template, legal. */
export function SiteFooter() {
  const t = useTranslations("video.footer");
  const navT = useTranslations("video.nav");
  const templatesT = useTranslations("video.templates");
  const authT = useTranslations("auth");

  const sections: Array<{ title: string; links: FooterLink[] }> = [
    {
      title: t("product"),
      links: [
        { label: navT("studio"), to: "/studio" },
        ...(SINGLE_TEMPLATE_ID ? [] : [{ label: navT("templates"), to: "/templates" }]),
        { label: navT("pricing"), to: "/pricing" },
        { label: navT("howItWorks"), to: "/", hash: "how-it-works" },
        { label: navT("faq"), to: "/", hash: "faq" },
      ],
    },
    {
      title: t("templates"),
      links: templatesNewestFirst().map((id) => ({
        label: templatesT(`${id}.name`),
        to: templatePath(id),
      })),
    },
    {
      title: t("resources"),
      links: [
        { label: navT("blog"), to: "/blog" },
        { label: authT("termsOfService"), to: "/terms" },
        { label: authT("privacyPolicy"), to: "/privacy" },
      ],
    },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Link to="/" className="inline-flex">
              <BrandLogo size={28} />
            </Link>
            <p className="text-muted-foreground mt-4 text-sm leading-6">{t("description")}</p>
            <a
              href={`mailto:${webConfig.SupportEmail}`}
              className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm transition-colors"
            >
              {webConfig.SupportEmail}
            </a>
            {webConfig.SocialUrls.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {webConfig.SocialUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {socialLabel(url)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {sections.map((section) => (
            <div key={section.title}>
              <p className="eyebrow">{section.title}</p>
              <ul className="mt-5 space-y-3 text-sm">
                {section.links.map((link) => (
                  <li key={`${link.to}${link.hash ?? ""}`}>
                    <Link
                      to={link.to}
                      hash={link.hash}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-muted-foreground mt-16 flex flex-col gap-4 border-t pt-8 text-xs sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-xl leading-5">{t("disclaimer", { appName: webConfig.AppName })}</p>
          <p className="shrink-0">
            {t("copyright", { year: currentYear, appName: webConfig.AppName })}
          </p>
        </div>
      </div>
    </footer>
  );
}
