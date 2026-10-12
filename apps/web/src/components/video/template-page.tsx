import {
  type VideoTemplateId,
  getVideoRenderSeconds,
  isVideoHighlight,
  videoTemplates,
} from "@repo/app-config/video";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/i18n";
import { templateFromCredits } from "@/lib/video/template-catalog";
import { cn } from "@/lib/utils";
import { CaseVideo, TemplateMedia } from "./media";
import { StudioCreator } from "./studio-creator";
import { MoreTemplates, useTemplatePhotosLabel } from "./template-gallery";
import { sampleForModel, templateAspectClass } from "@/lib/video/templates";
import { videoConfig } from "@repo/app-config/video";

export const TEMPLATE_STEP_KEYS = ["upload", "render", "share"] as const;
export const TEMPLATE_FAQ_KEYS = ["photos", "time", "refund", "privacy", "commercial"] as const;

/** Values interpolated into the template page copy. */
export function templateCopyValues(templateId: VideoTemplateId) {
  const template = videoTemplates[templateId];
  return {
    photos: template.slots.length,
    seconds: template.durationSeconds,
    aspect: template.aspectRatio,
    credits: templateFromCredits(templateId),
  };
}

/** Preview on the template page: the sample render for the picked version, else the template loop. */
function TemplatePreview({
  templateId,
  model,
}: {
  templateId: VideoTemplateId;
  model: (typeof videoConfig)["defaultModel"];
}) {
  const t = useTranslations("video.templatePage");
  const tVersion = useTranslations("video.studio.version");
  const sample = sampleForModel(templateId, model);
  const aspect = templateAspectClass(templateId);

  if (sample) {
    const seconds = getVideoRenderSeconds(templateId, model);
    return (
      <CaseVideo
        src={sample.video}
        poster={sample.poster}
        label={t("playSample")}
        badge={
          sample.cut
            ? tVersion(isVideoHighlight(templateId, model) ? "highlight" : "full", { seconds })
            : undefined
        }
        className={cn("w-full rounded-3xl", aspect)}
      />
    );
  }

  return (
    <TemplateMedia templateId={templateId} className={cn("w-full rounded-3xl border", aspect)} />
  );
}

/** A template's own page: preview, quick facts, the create form, steps, FAQ and more templates. */
export function TemplatePage({ templateId }: { templateId: VideoTemplateId }) {
  const t = useTranslations("video.templatePage");
  const tTemplates = useTranslations("video.templates");
  const photosLabel = useTemplatePhotosLabel();
  const [model, setModel] = useState(videoConfig.defaultModel);
  const template = videoTemplates[templateId];
  const values = templateCopyValues(templateId);
  const facts = [
    { label: t("facts.photos"), value: photosLabel(templateId) },
    { label: t("facts.length"), value: t("facts.seconds", { seconds: template.durationSeconds }) },
    { label: t("facts.format"), value: template.aspectRatio },
    { label: t("facts.from"), value: t("facts.credits", { credits: values.credits }) },
  ];

  return (
    <main>
      <section className="hero-glow pt-24 pb-16 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link
            to="/templates"
            className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Link>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="display mt-3 text-4xl sm:text-6xl">
                {tTemplates(`${templateId}.name`)}
              </h1>
              <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">
                {tTemplates(`${templateId}.description`)}
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label} className="bg-background px-4 py-3">
                    <dt className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-8">
                <TemplatePreview templateId={templateId} model={model} />
              </div>
            </div>
            <div className="lg:sticky lg:top-24">
              <StudioCreator id="create" templateId={templateId} onModelChange={setModel} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="eyebrow">{t("stepsEyebrow")}</p>
          <h2 className="display mt-3 text-3xl sm:text-4xl">
            {t("stepsTitle", { name: tTemplates(`${templateId}.name`) })}
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {TEMPLATE_STEP_KEYS.map((key, index) => (
              <li key={key} className="bg-card rounded-3xl border p-6">
                <span className="text-primary font-mono text-sm">0{index + 1}</span>
                <h3 className="mt-4 text-lg font-medium">{t(`steps.${key}.title`)}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t(`steps.${key}.body`, values)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="eyebrow text-center">FAQ</p>
          <h2 className="display mt-3 text-center text-3xl sm:text-4xl">{t("faqTitle")}</h2>
          <Accordion className="bg-card mt-8 w-full rounded-3xl border px-6 py-2">
            {TEMPLATE_FAQ_KEYS.map((key) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                  {t(`faq.${key}.q`)}
                </AccordionTrigger>
                <AccordionContent hiddenUntilFound>
                  <p className="text-muted-foreground">{t(`faq.${key}.a`, values)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <MoreTemplates current={templateId} />
    </main>
  );
}
