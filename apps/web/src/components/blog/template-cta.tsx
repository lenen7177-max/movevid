import { type VideoTemplateId } from "@repo/app-config/video";
import { buttonVariants } from "@repo/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { templateCopyValues } from "@/lib/video/template-content";
import { templatePath } from "@/lib/video/templates";
import { useTemplatePhotosLabel } from "@/components/video/template-gallery";

/**
 * Call to action in a template's how-to guide, linking to the template page (the home page on
 * a single-template site). Shown at the top and the bottom of the article.
 */
export function TemplateCta({
  templateId,
  className,
}: {
  templateId: VideoTemplateId;
  className?: string;
}) {
  const t = useTranslations("blog.detail.templateCta");
  const tTemplates = useTranslations("video.templates");
  const photosLabel = useTemplatePhotosLabel();
  const values = {
    ...templateCopyValues(templateId),
    name: tTemplates(`${templateId}.name`),
    photosLabel: photosLabel(templateId).toLowerCase(),
  };
  return (
    <aside
      data-template-cta=""
      className={cn(
        "bg-card flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <p className="eyebrow">{t("eyebrow")}</p>
        <p className="mt-2 text-lg font-medium">{t("title", values)}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("body", values)}</p>
      </div>
      <Link
        to={templatePath(templateId)}
        className={cn(buttonVariants({ size: "lg" }), "shrink-0 rounded-full no-underline")}
      >
        {t("button", values)}
        <ArrowRight aria-hidden="true" />
      </Link>
    </aside>
  );
}
