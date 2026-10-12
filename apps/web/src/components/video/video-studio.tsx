import {
  VIDEO_TEMPLATE_IDS,
  type VideoModel,
  type VideoTemplateId,
  videoConfig,
  videoTemplates,
  getVideoRenderSeconds,
} from "@repo/app-config/video";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { Badge } from "@repo/ui/badge";
import { Button, buttonVariants } from "@repo/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Download, ImageOff, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/i18n";
import { trackGenerateResult } from "@/lib/analytics/events";
import { authClient } from "@/lib/auth/auth-client";
import {
  sampleForModel,
  sampleRender,
  templateAspectClass,
  templateLink,
  templatePoster,
} from "@/lib/video/templates";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { CaseVideo } from "./media";
import { MoreTemplates } from "./template-gallery";
import { RenderProgress, useRenderAlerts } from "./render-progress";
import { ShareActions } from "./share-actions";
import { MODEL_TIER, StudioCreator } from "./studio-creator";
import { useSoundtrackedVideo } from "./use-soundtracked-video";

const POLL_MS = 4000;
// Friendly copy for failures the server recognizes; anything else shows the raw reason.
const FAILURE_COPY = {
  photo_rejected: "photoRejected",
  content_blocked: "contentBlocked",
  timeout: "renderTimeout",
} as const;
// A rejected photo is named by its position in the template ("Photo 3"), not by left/right.
const REJECTED_PHOTO_SLOT = {
  photo_left_rejected: "left",
  photo_middle_rejected: "middle",
  photo_right_rejected: "right",
} as const;

export type VideoJob = Awaited<ReturnType<typeof orpc.video.get.call>>;

const statusBadgeVariant = {
  processing: "secondary",
  succeeded: "default",
  failed: "destructive",
} as const;

function FinishedVideo({
  jobId,
  templateId,
  model,
  videoUrl,
  autoPlay,
  onReset,
}: {
  jobId: string;
  templateId: VideoTemplateId;
  model: VideoModel;
  videoUrl: string;
  autoPlay: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("video.studio.result");
  const video = useSoundtrackedVideo(videoUrl, templateId, model);
  const aspect = templateAspectClass(templateId);
  const fileName = `video-${jobId.slice(0, 8)}.mp4`;

  if (!video || video.status === "mixing") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border bg-black p-6 text-center text-white",
          aspect,
        )}
      >
        <Loader2 className="size-8 animate-spin" aria-hidden="true" />
        <p className="text-sm" aria-live="polite">
          {t("mixing")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <video
        key={video.src}
        src={video.src}
        aria-label={t("videoLabel")}
        className={cn("w-full rounded-2xl bg-black", aspect)}
        controls
        autoPlay={autoPlay}
        playsInline
      />
      <div className="flex flex-wrap gap-2">
        <a href={video.downloadHref} className={buttonVariants()} download={fileName}>
          <Download aria-hidden="true" />
          {t("download")}
        </a>
        <Button type="button" variant="outline" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          {t("again")}
        </Button>
      </div>
      <ShareActions
        src={video.src}
        downloadHref={video.downloadHref}
        fileName={fileName}
        templateId={templateId}
        withSoundtrack={video.withSoundtrack}
      />
    </div>
  );
}

function SampleResult({
  templateId,
  onReset,
}: {
  templateId: VideoTemplateId;
  onReset: () => void;
}) {
  const t = useTranslations("video.studio.result");
  const tVersion = useTranslations("video.studio.version");
  const sample = sampleRender(templateId);
  if (!sample) return null;

  let sampleNote = t("sampleNote");
  if (sample.model && sample.quality) {
    sampleNote = t("sampleTierNote", {
      tier: tVersion(MODEL_TIER[sample.model]),
      quality: sample.quality,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{t("sampleBadge")}</Badge>
        <p className="text-muted-foreground text-sm">{sampleNote}</p>
      </div>
      <video
        src={sample.video}
        poster={sample.poster}
        aria-label={t("videoLabel")}
        className={cn("w-full rounded-2xl bg-black", templateAspectClass(templateId))}
        controls
        autoPlay
        playsInline
      />
      <Button type="button" onClick={onReset}>
        <RotateCcw aria-hidden="true" />
        {t("useOwnPhotos")}
      </Button>
    </div>
  );
}

export function ResultPanel({
  job,
  demo,
  templateId = videoConfig.defaultTemplateId,
  model,
  autoPlay = true,
  onReset,
}: {
  job: VideoJob | undefined;
  demo?: boolean;
  /** Template shown before a job exists (empty state and sample result). */
  templateId?: VideoTemplateId;
  /** Version picked in the creator; the empty-state sample follows it (full or highlight). */
  model?: VideoModel;
  /** Start a finished video right away; off when browsing past works. */
  autoPlay?: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("video.studio.result");
  const tErrors = useTranslations("video.errors");
  const tTemplates = useTranslations("video.templates");
  const tVersion = useTranslations("video.studio.version");

  // Reports each recent job's outcome once, the first time this browser sees it finished.
  useEffect(() => {
    if (job) trackGenerateResult(job);
  }, [job]);

  if (!job && demo) return <SampleResult templateId={templateId} onReset={onReset} />;

  const fullSample = templateId ? sampleRender(templateId) : null;
  let emptySample: { video: string; poster: string } | null = fullSample;
  let emptyBadge: string | undefined;
  if (templateId && model) {
    const picked = sampleForModel(templateId, model);
    emptySample = picked;
    if (picked?.cut) {
      emptyBadge = tVersion(picked.cut, { seconds: getVideoRenderSeconds(templateId, model) });
    }
  }
  if (!job && templateId && emptySample) {
    return (
      <figure>
        <CaseVideo
          src={emptySample.video}
          poster={emptySample.poster}
          badge={emptyBadge}
          label={t("sampleEmptyLabel", { name: tTemplates(`${templateId}.name`) })}
          className={cn("w-full rounded-2xl shadow-sm", templateAspectClass(templateId))}
        />
        <figcaption className="text-muted-foreground mt-3 text-center text-sm text-pretty">
          <span className="text-foreground font-medium">{t("sampleBadge")}</span>
          {" · "}
          {t("sampleEmptyBody")}
        </figcaption>
      </figure>
    );
  }

  if (!job) {
    return (
      <div
        className={cn(
          "dot-grid bg-card flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center",
          templateAspectClass(templateId),
        )}
      >
        <Clapperboard className="text-primary size-8" aria-hidden="true" />
        <p className="font-semibold">{t("emptyTitle")}</p>
        <p className="text-muted-foreground max-w-sm text-sm">{t("emptyBody")}</p>
      </div>
    );
  }

  if (job.status === "succeeded" && job.videoUrl) {
    return (
      <FinishedVideo
        jobId={job.id}
        templateId={job.templateId}
        model={job.model}
        videoUrl={job.videoUrl}
        autoPlay={autoPlay}
        onReset={onReset}
      />
    );
  }

  if (job.status === "failed") {
    return (
      <div
        className={cn(
          "border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-2 rounded-2xl border p-6 text-center",
          templateAspectClass(job.templateId),
        )}
      >
        <p className="font-semibold">{t("failed")}</p>
        {job.errorCode ? (
          <p className="max-w-sm text-sm">
            {job.errorCode in REJECTED_PHOTO_SLOT
              ? tErrors("photoNumberRejected", {
                  n:
                    (videoTemplates[job.templateId].slots as readonly string[]).indexOf(
                      REJECTED_PHOTO_SLOT[job.errorCode as keyof typeof REJECTED_PHOTO_SLOT],
                    ) + 1,
                })
              : tErrors(FAILURE_COPY[job.errorCode as keyof typeof FAILURE_COPY])}
          </p>
        ) : null}
        {!job.errorCode && job.error ? (
          <p className="text-muted-foreground max-w-sm text-xs break-words">
            {t("failedReason", { reason: job.error })}
          </p>
        ) : null}
        {job.creditsRefunded ? (
          <p className="text-muted-foreground text-sm">
            {t("refunded", { cost: job.creditsCost })}
          </p>
        ) : null}
        <Button type="button" variant="outline" className="mt-2" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          {t("again")}
        </Button>
      </div>
    );
  }

  return <RenderProgress job={job} />;
}

export function HistoryList({
  jobs,
  activeId,
  onSelect,
  className = "mt-12",
}: {
  jobs: VideoJob[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const t = useTranslations("video.studio.history");
  const tTemplates = useTranslations("video.templates");

  return (
    <section className={className}>
      <h2 className="mb-4 text-xl font-semibold">{t("title")}</h2>
      {jobs.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onSelect(job.id)}
                aria-label={`${t("view")} · ${new Date(job.createdAt).toLocaleString()}`}
                className={cn(
                  "bg-card w-full overflow-hidden rounded-2xl border text-left transition-shadow hover:shadow-md",
                  job.id === activeId && "ring-primary ring-2",
                )}
              >
                {/* Photos are deleted 30 days after a job; the card then shows a placeholder. */}
                {!job.leftImageUrl ? (
                  <div className="bg-muted text-muted-foreground flex aspect-video items-center justify-center">
                    <ImageOff className="size-5" aria-hidden="true" />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "grid",
                    job.middleImageUrl && "grid-cols-3",
                    !job.middleImageUrl && job.rightImageUrl && "grid-cols-2",
                  )}
                >
                  {[job.leftImageUrl, job.middleImageUrl, job.rightImageUrl]
                    .filter((url): url is string => Boolean(url))
                    .map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ))}
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 text-xs">
                  <span className="text-muted-foreground truncate">
                    {tTemplates(`${job.templateId}.name`)} ·{" "}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <Badge variant={statusBadgeVariant[job.status]}>{t(job.status)}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Studio: pick a template, two photos → render, with polling and history. */
export function VideoStudio({
  jobId,
  demo,
  templateId,
  onTemplateChange,
}: {
  jobId?: string;
  demo?: boolean;
  templateId: VideoTemplateId;
  onTemplateChange: (templateId: VideoTemplateId) => void;
}) {
  const t = useTranslations("video");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  // Reported by the creator, so the sample on the right matches the picked version.
  const [model, setModel] = useState<VideoModel>(videoConfig.defaultModel);
  const signedIn = Boolean(session?.user);

  const historyQuery = useQuery({
    queryKey: ["video", "list"],
    queryFn: () => orpc.video.list.call({ limit: 12 }),
    enabled: signedIn,
  });

  const jobQuery = useQuery({
    queryKey: ["video", "job", jobId],
    queryFn: () => orpc.video.get.call({ id: jobId ?? "" }),
    enabled: signedIn && Boolean(jobId),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? POLL_MS : false),
  });
  const job = jobQuery.data;
  useRenderAlerts(job);

  // Refresh balance and history once a render settles.
  const settledRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!job || job.status === "processing" || settledRef.current === job.id) return;
    settledRef.current = job.id;
    void queryClient.invalidateQueries({ queryKey: ["video", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
  }, [job, queryClient]);

  return (
    <main className="pt-28 pb-8 sm:pt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-10">
          <p className="eyebrow">
            {t("studio.page.eyebrow", { count: VIDEO_TEMPLATE_IDS.length })}
          </p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{t("studio.page.title")}</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
            {t("studio.page.subtitle")}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
          <StudioCreator
            templateId={templateId}
            onTemplateChange={onTemplateChange}
            onModelChange={setModel}
            jobProcessing={job?.status === "processing"}
          />

          <section aria-label={t("studio.result.title")}>
            {/* What the selected template makes, with a link to its full page */}
            <div className="bg-card mb-4 flex items-start gap-3 rounded-2xl border p-3">
              <img
                src={templatePoster(templateId)}
                alt=""
                className="bg-muted size-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">{t("studio.selected.label")}</p>
                <p className="font-semibold">{t(`templates.${templateId}.name`)}</p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                  {t(`templates.${templateId}.tagline`)}
                </p>
                <Link
                  {...templateLink(templateId)}
                  className="text-primary mt-1 inline-block text-sm font-medium hover:underline"
                >
                  {t("studio.selected.viewPage")} →
                </Link>
              </div>
            </div>
            <ResultPanel
              job={job}
              demo={demo}
              templateId={templateId}
              model={model}
              onReset={() => {
                void navigate({ to: "/studio", search: { template: templateId } });
              }}
            />
          </section>
        </div>

        {signedIn ? (
          <HistoryList
            jobs={historyQuery.data?.jobs ?? []}
            activeId={jobId}
            onSelect={(id) => {
              void navigate({ to: "/studio", search: { job: id } });
            }}
          />
        ) : null}
      </div>

      {/* Every template, linked to its own page */}
      <MoreTemplates
        title={t("studio.templatesSection.title")}
        subtitle={t("studio.templatesSection.subtitle")}
      />

      <StudioFaq />
    </main>
  );
}

export const STUDIO_FAQ_KEYS = ["choose", "photos", "time", "refund", "privacy"] as const;

/** General questions for the studio, which serves every template. */
function StudioFaq() {
  const t = useTranslations("video.studio.faq");
  return (
    <section className="pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="eyebrow text-center">FAQ</p>
        <h2 className="display mt-3 mb-8 text-center text-3xl sm:text-4xl">{t("title")}</h2>
        <Accordion className="bg-card w-full rounded-3xl border px-6 py-2">
          {STUDIO_FAQ_KEYS.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                {t(`items.${key}.q`)}
              </AccordionTrigger>
              <AccordionContent hiddenUntilFound>
                <p className="text-muted-foreground">{t(`items.${key}.a`)}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
