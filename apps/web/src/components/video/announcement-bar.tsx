import { Link, useHydrated, useMatch } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/i18n";
import { ANNOUNCED_TEMPLATE_ID, templateLink } from "@/lib/video/templates";

const dismissedKey = (templateId: string) => `announce-dismissed:${templateId}`;

/**
 * A chip under the header announcing ANNOUNCED_TEMPLATE_ID, linking to its page. The home hero
 * has its own chip, so it's hidden there. Dismissing it is remembered per template, so the next
 * announcement shows again.
 */
export function AnnouncementBar() {
  const t = useTranslations("video.announce");
  const tTemplates = useTranslations("video.templates");
  const onHome = useMatch({ from: "/_public/(marketing)/(landing-page)/", shouldThrow: false });
  // localStorage only exists in the browser; render nothing until hydration so SSR matches.
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      ANNOUNCED_TEMPLATE_ID !== null &&
      window.localStorage.getItem(dismissedKey(ANNOUNCED_TEMPLATE_ID)) === "1",
  );

  const templateId = ANNOUNCED_TEMPLATE_ID;
  if (!templateId || onHome || !hydrated || dismissed) return null;

  const dismiss = () => {
    window.localStorage.setItem(dismissedKey(templateId), "1");
    setDismissed(true);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] z-40 flex justify-center px-3">
      <div className="bg-card/85 pointer-events-auto flex max-w-full items-center gap-2 rounded-full border py-1 pr-1 pl-1 text-xs shadow-lg backdrop-blur-xl sm:text-sm">
        <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase">
          {t("badge")}
        </span>
        <Link
          {...templateLink(templateId)}
          className="flex min-w-0 items-center gap-1.5 hover:underline"
        >
          <span className="truncate">{t("text", { name: tTemplates(`${templateId}.name`) })}</span>
          <span className="text-primary inline-flex shrink-0 items-center gap-0.5 font-semibold">
            {t("cta")}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
