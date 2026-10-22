import { getOrpcErrorReason } from "@repo/api-client";
import {
  VIDEO_QUALITIES,
  type VideoModel,
  type VideoQuality,
  type VideoTemplateId,
  getVideoCreditsCost,
  getVideoFirstFullCredits,
  getVideoRenderSeconds,
  getVideoTemplateModels,
  isVideoModelQuality,
} from "@repo/app-config/video";
import { Button } from "@repo/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import { trackGenerateStart } from "@/lib/analytics/events";
import { orpc } from "@/utils/orpc";
import { openBuyCreditsDialog } from "./buy-credits-dialog";
import { MODEL_TIER } from "./studio-creator";

type Upgrade = { model: VideoModel; quality: VideoQuality; kind: "premium" | "sharper" };

/**
 * Versions that improve on a finished render: the same quality on Premium (the full video when
 * Fast rendered the highlight), and the next quality up on the same version. Never a step down.
 */
function upgradesFor(templateId: VideoTemplateId, model: VideoModel, quality: VideoQuality) {
  const models = getVideoTemplateModels(templateId);
  const upgrades: Upgrade[] = [];
  if (MODEL_TIER[model] === "fast") {
    const premium = models.find((option) => MODEL_TIER[option] === "premium");
    if (premium && isVideoModelQuality(premium, quality)) {
      upgrades.push({ model: premium, quality, kind: "premium" });
    }
  }
  const sharper = VIDEO_QUALITIES.slice(VIDEO_QUALITIES.indexOf(quality) + 1).find((option) =>
    isVideoModelQuality(model, option),
  );
  if (sharper) upgrades.push({ model, quality: sharper, kind: "sharper" });
  return upgrades;
}

/** Under a finished video: make it again on Premium or in a higher quality, from the same photos. */
export function UpgradeOffers({
  jobId,
  templateId,
  model,
  quality,
}: {
  jobId: string;
  templateId: VideoTemplateId;
  model: VideoModel;
  quality: VideoQuality;
}) {
  const t = useTranslations("video.studio");
  const tErrors = useTranslations("video.errors");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const balanceQuery = useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => orpc.credits.getBalance.call({}),
    staleTime: 30_000,
  });
  const offerQuery = useQuery({
    queryKey: ["video", "offer", true],
    queryFn: () => orpc.video.offer.call({}),
    staleTime: 60_000,
  });
  const firstFull = offerQuery.data?.firstFull ?? false;
  const priceOf = (upgrade: Upgrade) =>
    (firstFull ? getVideoFirstFullCredits(upgrade.quality, templateId, upgrade.model) : null) ??
    getVideoCreditsCost(upgrade.quality, templateId, upgrade.model);

  const upgradeMutation = useMutation({
    // The server reads the photos from the finished job, so nothing is uploaded again.
    mutationFn: (upgrade: Upgrade) =>
      orpc.video.create.call({
        templateId,
        model: upgrade.model,
        quality: upgrade.quality,
        sourceJobId: jobId,
      }),
    onSuccess: async (created, upgrade) => {
      trackGenerateStart({
        jobId: created.id,
        templateId,
        quality: upgrade.quality,
        model: upgrade.model,
        credits: created.creditsCost,
      });
      queryClient.setQueryData(["video", "job", created.id], created);
      void queryClient.invalidateQueries({ queryKey: ["video", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
      void queryClient.invalidateQueries({ queryKey: ["video", "offer"] });
      await navigate({ to: "/studio", search: { job: created.id } });
    },
    onError: (error) => {
      const reason = getOrpcErrorReason(error);
      if (reason === "INSUFFICIENT_CREDITS") {
        toast.error(tErrors("insufficientCredits"), {
          action: { label: t("buyCredits"), onClick: () => openBuyCreditsDialog() },
        });
        return;
      }
      toast.error(reason === "MISSING_PHOTO" ? t("upgrade.photoGone") : tErrors("generic"));
    },
  });

  const upgrades = upgradesFor(templateId, model, quality);
  if (upgrades.length === 0) return null;
  const balance = balanceQuery.data?.balance;
  const busy = upgradeMutation.isPending || upgradeMutation.isSuccess;

  return (
    <section className="bg-card rounded-2xl border p-4">
      <h3 className="flex items-center gap-1.5 font-semibold">
        <Sparkles className="text-primary size-4" aria-hidden="true" />
        {t("upgrade.title")}
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">{t("upgrade.body")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {upgrades.map((upgrade) => {
          const credits = priceOf(upgrade);
          const pending = upgradeMutation.isPending && upgradeMutation.variables === upgrade;
          const short = balance != null && balance < credits;
          return (
            <Button
              key={`${upgrade.model}-${upgrade.quality}`}
              type="button"
              variant={upgrade.kind === "premium" ? "default" : "outline"}
              className="h-auto flex-col items-start gap-0.5 py-2.5 text-left whitespace-normal"
              disabled={busy}
              onClick={() => (short ? openBuyCreditsDialog() : upgradeMutation.mutate(upgrade))}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {t(`upgrade.${upgrade.kind}`, {
                  quality: upgrade.quality,
                  seconds: getVideoRenderSeconds(templateId, upgrade.model),
                })}
              </span>
              <span className="text-xs font-normal opacity-80">
                {short ? t("upgrade.short", { credits }) : t("upgrade.cost", { credits })}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
