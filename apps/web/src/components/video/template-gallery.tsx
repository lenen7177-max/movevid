import { type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/i18n";
import {
  isNewTemplate,
  templateFromCredits,
  templatePhotoRange,
  templatesNewestFirst,
} from "@/lib/video/template-catalog";
import { templateLink } from "@/lib/video/templates";
import { cn } from "@/lib/utils";
import { TemplateMedia } from "./media";

/** "2 photos" or "1–3 photos" for a template. */
export function useTemplatePhotosLabel() {
  const t = useTranslations("video.card");
  return (templateId: VideoTemplateId) => {
    const { min, max } = templatePhotoRange(templateId);
    return min < max ? t("photoRange", { min, max }) : t("photos", { count: max });
  };
}

/**
 * One template as a tall card: the poster (or preview loop on hover) fills the card, with the
 * name and facts on a gradient at the bottom.
 */
export function TemplateCard({
  templateId,
  className,
}: {
  templateId: VideoTemplateId;
  className?: string;
}) {
  const t = useTranslations("video.card");
  const tTemplates = useTranslations("video.templates");
  const photosLabel = useTemplatePhotosLabel();
  const [hovered, setHovered] = useState(false);
  const template = videoTemplates[templateId];
  const name = tTemplates(`${templateId}.name`);

  return (
    <Link
      {...templateLink(templateId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        "group bg-card ring-border focus-visible:ring-ring relative block aspect-[4/5] overflow-hidden rounded-3xl ring-1 outline-none focus-visible:ring-2",
        className,
      )}
    >
      <TemplateMedia
        templateId={templateId}
        playing={hovered}
        alt={t("alt", { name })}
        className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      <div className="absolute top-3 left-3 flex gap-1.5">
        {isNewTemplate(templateId) ? (
          <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
            {t("new")}
          </span>
        ) : null}
        <span className="rounded-full bg-black/45 px-2.5 py-1 font-mono text-[10px] font-medium tracking-wider text-white/90 uppercase backdrop-blur">
          {template.aspectRatio} · {t("seconds", { seconds: template.durationSeconds })}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium tracking-tight">{name}</h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-white/70">
              {tTemplates(`${templateId}.tagline`)}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur transition-colors group-hover:bg-white group-hover:text-black">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-3 font-mono text-[11px] tracking-wide text-white/60">
          {photosLabel(templateId)} ·{" "}
          {t("fromCredits", { credits: templateFromCredits(templateId) })}
        </p>
      </div>
    </Link>
  );
}

/** Every template in a grid, newest first (the /templates page). */
export function TemplateGallery({
  exclude,
  className,
}: {
  exclude?: VideoTemplateId;
  className?: string;
}) {
  const ids = templatesNewestFirst().filter((id) => id !== exclude);
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {ids.map((id) => (
        <li key={id}>
          <TemplateCard templateId={id} />
        </li>
      ))}
    </ul>
  );
}

/** "More templates" section with a link to /templates; used under template pages and the studio. */
export function MoreTemplates({
  current,
  title,
  subtitle,
  className,
}: {
  current?: VideoTemplateId;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const t = useTranslations("video.gallery");
  if (templatesNewestFirst().every((id) => id === current)) return null;

  return (
    <section className={cn("py-16 sm:py-24", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t("moreEyebrow")}</p>
            <h2 className="display mt-3 text-3xl sm:text-4xl">{title ?? t("moreTitle")}</h2>
            <p className="text-muted-foreground mt-2 max-w-xl">{subtitle ?? t("moreSubtitle")}</p>
          </div>
          <Link
            to="/templates"
            className="text-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            {t("viewAll")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <TemplateGallery exclude={current} />
      </div>
    </section>
  );
}
