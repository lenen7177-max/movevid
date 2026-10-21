import {
  VIDEO_TEMPLATE_IDS,
  type VideoTemplateId,
  videoTemplateAllowsPets,
  videoTemplates,
  getVideoMinPhotos,
} from "@repo/app-config/video";
import { Button } from "@repo/ui/button";
import { Clapperboard, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import { isNewTemplate } from "@/lib/video/template-catalog";
import { hasSampleRender, templatePoster } from "@/lib/video/templates";
import { cn } from "@/lib/utils";
import { PhotoPairPicker } from "./photo-pair-picker";
import { useTemplatePhotosLabel } from "./template-gallery";
import { fetchSamplePhotos, type PhotoPair } from "./use-photo-pair";

type CreatorCardProps = {
  pair: PhotoPair;
  templateId: VideoTemplateId;
  /** Shows a template switcher; without it the template is fixed (landing pages). */
  onTemplateChange?: (templateId: VideoTemplateId) => void;
  disabled?: boolean;
  /** Primary action (generate, buy credits), full width under the controls. */
  primaryAction: ReactNode;
  /** Optional controls between the template bar and the actions (quality, cost). */
  children?: ReactNode;
  /** Shown right above the primary action, e.g. the consent checkbox. */
  beforeAction?: ReactNode;
  /** Optional note under the actions. */
  footer?: ReactNode;
  /** The fixed-template bar (name · photos · length); landing pages already show it in the H1. */
  showTemplateBar?: boolean;
  id?: string;
  className?: string;
};

/** Shared creator: photo pair, sample photos, template bar and the primary action. */
export function CreatorCard({
  pair,
  templateId,
  onTemplateChange,
  disabled,
  primaryAction,
  children,
  beforeAction,
  footer,
  showTemplateBar = true,
  id,
  className,
}: CreatorCardProps) {
  const t = useTranslations("video");
  const photosLabel = useTemplatePhotosLabel();
  const [loadingSamples, setLoadingSamples] = useState(false);
  // Sample photos are only offered where their pre-rendered result exists.
  const showSamples = hasSampleRender(templateId);

  const trySamples = async () => {
    setLoadingSamples(true);
    try {
      pair.setSamplePhotos(await fetchSamplePhotos(templateId));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setLoadingSamples(false);
    }
  };

  // "2 photos · 20 s" under each template name in the switcher.
  const templateMeta = (option: VideoTemplateId) =>
    t("studio.templateMeta", {
      photos: photosLabel(option),
      seconds: videoTemplates[option].durationSeconds,
    });

  return (
    <div
      id={id}
      className={cn(
        "bg-card h-fit rounded-3xl border p-4 shadow-2xl shadow-black/10 sm:p-5 dark:shadow-black/40",
        className,
      )}
    >
      <PhotoPairPicker
        pair={pair}
        slots={videoTemplates[templateId].slots}
        roles={Object.fromEntries(
          videoTemplates[templateId].slots.map((slot) => [
            slot,
            t(`templates.${templateId}.${slot}Role`),
          ]),
        )}
        minPhotos={getVideoMinPhotos(templateId)}
        allowsPets={videoTemplateAllowsPets(templateId)}
        disabled={disabled}
      />
      {showSamples ? (
        // Fills the photo slots above, so it sits right under them.
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          disabled={loadingSamples || disabled}
          onClick={trySamples}
        >
          <Sparkles aria-hidden="true" />
          {t("studio.trySamples")}
        </Button>
      ) : null}
      {onTemplateChange ? (
        <fieldset className="mt-4" disabled={disabled}>
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Clapperboard className="text-primary size-4" aria-hidden="true" />
            {t("studio.templateLabel")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {VIDEO_TEMPLATE_IDS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={templateId === option}
                onClick={() => onTemplateChange(option)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 text-left transition-colors disabled:opacity-60",
                  templateId === option
                    ? "border-primary bg-primary/10 ring-primary ring-1"
                    : "hover:bg-muted",
                )}
              >
                <img
                  src={templatePoster(option)}
                  alt=""
                  loading="lazy"
                  className="bg-muted size-10 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm leading-tight font-semibold">
                    {t(`templates.${option}.name`)}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {templateMeta(option)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : showTemplateBar ? (
        <div className="bg-muted/60 mt-4 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clapperboard className="text-primary size-4" aria-hidden="true" />
            {t(`templates.${templateId}.name`)}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {isNewTemplate(templateId) ? t("card.new") : templateMeta(templateId)}
          </span>
        </div>
      ) : null}
      {children}
      {beforeAction}
      <div className="mt-3 grid">{primaryAction}</div>
      {footer}
    </div>
  );
}
