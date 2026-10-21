import {
  type VideoTemplateId,
  getVideoCreditsCost,
  getVideoRenderSeconds,
  getVideoTemplateModels,
  isVideoHighlight,
  isVideoTemplateId,
  videoConfig,
  videoTemplates,
} from "@repo/app-config/video";
import { MODEL_TIER } from "@/components/video/studio-creator";
import { useTranslations } from "@/i18n";
import { estimateRenderMinutes } from "@/lib/video/render-eta";
import { templateCopyValues } from "@/lib/video/template-content";

/**
 * Template facts for how-to guides, read from app-config so a post never drifts from the
 * product: `<TemplateValue template="duo_dance" name="seconds" />` inline, and
 * `<TemplateFacts template="duo_dance" />` for the price table.
 */
type ValueName =
  | "photos"
  | "seconds"
  | "aspect"
  | "credits"
  | "price"
  | "highlightSeconds"
  | "minutes";

function values(templateId: VideoTemplateId) {
  const highlightModel = getVideoTemplateModels(templateId).find((model) =>
    isVideoHighlight(templateId, model),
  );
  return {
    ...templateCopyValues(templateId),
    highlightSeconds: highlightModel
      ? getVideoRenderSeconds(templateId, highlightModel)
      : videoTemplates[templateId].durationSeconds,
    // The create form's default selection.
    minutes: estimateRenderMinutes(
      templateId,
      videoConfig.defaultQuality,
      getVideoTemplateModels(templateId).includes(videoConfig.defaultModel)
        ? videoConfig.defaultModel
        : (getVideoTemplateModels(templateId)[0] ?? videoConfig.defaultModel),
    ),
  };
}

export function TemplateValue({ template, name }: { template: string; name: ValueName }) {
  if (!isVideoTemplateId(template)) return null;
  return <>{String(values(template)[name])}</>;
}

export function TemplateFacts({ template }: { template: string }) {
  const t = useTranslations("blog.detail.templateFacts");
  const tVersion = useTranslations("video.studio.version");
  if (!isVideoTemplateId(template)) return null;
  const rows = getVideoTemplateModels(template).flatMap((model) =>
    (["480p", "720p", "1080p"] as const).flatMap((quality) => {
      try {
        return [
          {
            key: `${model}-${quality}`,
            version: tVersion(MODEL_TIER[model]),
            seconds: getVideoRenderSeconds(template, model),
            quality,
            credits: getVideoCreditsCost(quality, template, model),
            minutes: estimateRenderMinutes(template, quality, model),
          },
        ];
      } catch {
        // The model doesn't render this quality.
        return [];
      }
    }),
  );
  return (
    <table>
      <thead>
        <tr>
          <th>{t("version")}</th>
          <th>{t("length")}</th>
          <th>{t("quality")}</th>
          <th>{t("credits")}</th>
          <th>{t("wait")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.version}</td>
            <td>{t("seconds", { seconds: row.seconds })}</td>
            <td>{row.quality}</td>
            <td>{row.credits}</td>
            <td>{t("minutes", { minutes: row.minutes })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
