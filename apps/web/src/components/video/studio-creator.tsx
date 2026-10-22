import { getOrpcErrorReason } from "@repo/api-client";
import {
  VIDEO_QUALITIES,
  type VideoModel,
  type VideoPhotoSlot,
  type VideoQuality,
  type VideoTemplateId,
  videoConfig,
  videoTemplates,
  getVideoCreditsCost,
  getVideoFirstFullCredits,
  getVideoMinPhotos,
  getVideoPurchaseQuote,
  getVideoRenderSeconds,
  getVideoTemplateModels,
  isVideoHighlight,
  isVideoModelQuality,
} from "@repo/app-config/video";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Coins, Loader2, SlidersHorizontal, Wand2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import {
  trackGenerateClick,
  trackGenerateStart,
  trackPhotoUpload,
  trackSampleView,
} from "@/lib/analytics/events";
import { rememberTemplate } from "@/lib/analytics/attribution";
import { authClient } from "@/lib/auth/auth-client";
import { ensureSession } from "@/lib/auth/guest-session";
import {
  clearHandoffPhotos,
  loadHandoffPhotos,
  saveHandoffPhotos,
} from "@/lib/video/photo-handoff";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { getVideoPricing } from "@/lib/video/pricing";
import { estimateRenderMinutes } from "@/lib/video/render-eta";
import { openBuyCreditsDialog } from "./buy-credits-dialog";
import { CreatorCard } from "./creator-card";
import { useMoney } from "./pricing-page";
import { usePhotoPair } from "./use-photo-pair";

/** How each model is offered: by what it's for, not by its name (keys of video.studio.version). */
export const MODEL_TIER = {
  "seedance-2.5": "premium",
  "seedance-2.0-fast": "fast",
} as const satisfies Record<VideoModel, string>;

type StudioCreatorProps = {
  templateId: VideoTemplateId;
  /** Lets the user switch templates (studio page); landing pages pass a fixed template. */
  onTemplateChange?: (templateId: VideoTemplateId) => void;
  /** Landing pages switch the hero preview to the matching full / highlight clip. */
  onModelChange?: (model: VideoModel) => void;
  /** Locks the form while the studio's current render is still running. */
  jobProcessing?: boolean;
  /** Landing pages repeat the button's label (with its price) in the sticky and closing CTAs. */
  onCtaLabelChange?: (label: string) => void;
  /** Hides the fixed-template bar; landing pages already name the template in the H1. */
  hideTemplateBar?: boolean;
  /**
   * Landing pages start on the default version and quality with the pickers folded away, so a
   * first visit is photo → button; one tap opens them. The studio always shows them.
   */
  compactOptions?: boolean;
  id?: string;
  className?: string;
};

/**
 * The create form, shared by template pages and /studio.
 * Starting a render always lands on /studio?job=<id> to follow progress.
 */
export function StudioCreator({
  templateId,
  onTemplateChange,
  onModelChange,
  jobProcessing,
  onCtaLabelChange,
  hideTemplateBar,
  compactOptions,
  id,
  className,
}: StudioCreatorProps) {
  const [optionsOpen, setOptionsOpen] = useState(!compactOptions);
  const t = useTranslations("video");
  const money = useMoney();
  const [consented, setConsented] = useSessionConsent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pair = usePhotoPair({
    onPhotoAdded: (slot, photos) => trackPhotoUpload({ templateId, slot, photos }),
  });
  const slots: readonly VideoPhotoSlot[] = videoTemplates[templateId].slots;
  const minPhotos = getVideoMinPhotos(templateId);
  // Uploads in slot order; templates with optional photos take them from the first slot on.
  const uploaded = slots.flatMap((slot) => {
    const photo = pair.photos[slot];
    return photo ? [photo] : [];
  });
  const models = getVideoTemplateModels(templateId);
  const [pickedModel, setModel] = useState<VideoModel>(videoConfig.defaultModel);
  // A template that isn't offered on the picked model falls back to its first one.
  const model = models.includes(pickedModel) ? pickedModel : (models[0] ?? pickedModel);
  const [quality, setQuality] = useState<VideoQuality>(videoConfig.defaultQuality);
  const highlight = isVideoHighlight(templateId, model);
  // The model that renders this template's highlight cut, if the template has one.
  const highlightModel = models.find((option) => isVideoHighlight(templateId, option));
  const { data: session, isPending: sessionPending } = authClient.useSession();
  // The server renders before the session is known; match that until hydration.
  const hydrated = useHydrated();
  const signedIn = Boolean(session?.user);
  const { setPhotos } = pair;

  // Restores photos saved before a sign-in round trip.
  useEffect(() => {
    let cancelled = false;
    void loadHandoffPhotos().then((photos) => {
      if (!cancelled && Object.keys(photos).length > 0) setPhotos(photos);
    });
    return () => {
      cancelled = true;
    };
  }, [setPhotos]);

  // Purchases made after working with this template are attributed to it.
  useEffect(() => {
    rememberTemplate(templateId);
  }, [templateId]);

  useEffect(() => {
    onModelChange?.(model);
  }, [model, onModelChange]);

  const balanceQuery = useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => orpc.credits.getBalance.call({}),
    enabled: signedIn,
    staleTime: 30_000,
  });
  // Signed-out visitors see the first-full price too; they haven't made a video yet.
  const offerQuery = useQuery({
    queryKey: ["video", "offer", signedIn],
    queryFn: () => orpc.video.offer.call({}),
    enabled: !sessionPending,
    staleTime: 60_000,
  });
  const firstFull = offerQuery.data?.firstFull ?? false;
  // What a render costs this account: its first full video gets the first-full price.
  const priceOf = (option: VideoQuality, forModel: VideoModel) =>
    (firstFull ? getVideoFirstFullCredits(option, templateId, forModel) : null) ??
    getVideoCreditsCost(option, templateId, forModel);

  const createMutation = useMutation({
    mutationFn: () => {
      const [left] = uploaded;
      if (!left || uploaded.length < minPhotos) {
        throw new Error("missing_photos");
      }
      // The n-th upload fills the template's n-th slot (e.g. left + right for two-person templates).
      const cast = Object.fromEntries(uploaded.map((photo, index) => [slots[index], photo]));
      return orpc.video.create.call({ templateId, quality, model, ...cast, left });
    },
    onSuccess: async (created) => {
      trackGenerateStart({
        jobId: created.id,
        templateId,
        quality,
        model,
        credits: priceOf(quality, model),
      });
      queryClient.setQueryData(["video", "job", created.id], created);
      void clearHandoffPhotos();
      void queryClient.invalidateQueries({ queryKey: ["video", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
      void queryClient.invalidateQueries({ queryKey: ["video", "offer"] });
      await navigate({ to: "/studio", search: { job: created.id } });
    },
    onError: (error) => {
      const reason = getOrpcErrorReason(error);
      if (reason === "INSUFFICIENT_CREDITS") {
        toast.error(t("errors.insufficientCredits"), {
          action: {
            label: t("studio.buyCredits"),
            onClick: buyCredits,
          },
        });
        return;
      }
      if (reason === "NOT_CONFIGURED") {
        toast.error(t("errors.notConfigured"));
        return;
      }
      if (reason === "PHOTO_REJECTED") {
        toast.error(t("errors.photoRejected"));
        return;
      }
      toast.error(reason === "SUBMIT_FAILED" ? t("errors.submitFailed") : t("errors.generic"));
    },
  });

  // Uploaded photos are kept across the checkout round trip, like the sign-in one.
  const buyCredits = () =>
    openBuyCreditsDialog({ beforeCheckout: () => saveHandoffPhotos(pair.photos) });

  const generate = async () => {
    // The sample pair has a pre-rendered result: show it without signing in or spending credits.
    if (pair.isSample) {
      trackSampleView(templateId);
      await navigate({ to: "/studio", search: { demo: true, template: templateId } });
      return;
    }
    const click = { templateId, quality, model, photos: uploaded.length };
    if (uploaded.length < minPhotos) {
      trackGenerateClick({ ...click, nextStep: "missing_photos" });
      toast.error(t("errors.needPhotos", { count: minPhotos }));
      return;
    }
    // Sent before the guest session and checkout, so every click reaches GA.
    trackGenerateClick({ ...click, nextStep: signedIn ? "create" : "checkout" });
    // No sign-in wall: a visitor becomes a guest and goes straight to picking a pack.
    if (!signedIn) {
      if (!(await ensureSession())) {
        toast.error(t("errors.generic"));
        return;
      }
      buyCredits();
      return;
    }
    createMutation.mutate();
  };

  const busy = createMutation.isPending || Boolean(jobProcessing);
  const balance = balanceQuery.data?.balance;
  const creditsCost = priceOf(quality, model);
  const firstFullApplied = creditsCost < getVideoCreditsCost(quality, templateId, model);
  // Seedance 2.0 models top out at 720p, so a 1080p pick steps down when switching to them.
  const chooseModel = (next: VideoModel) => {
    setModel(next);
    if (!isVideoModelQuality(next, quality)) setQuality("720p");
  };
  const notEnough = !pair.isSample && signedIn && balance != null && balance < creditsCost;
  // Without enough credits the Generate slot shows Buy credits; with the photos in, that click
  // still counts as one (click_generate is only for clicks with the user's own photos).
  const buyCreditsInstead = () => {
    if (uploaded.length >= minPhotos) {
      trackGenerateClick({
        templateId,
        quality,
        model,
        photos: uploaded.length,
        nextStep: "checkout",
      });
    }
    buyCredits();
  };
  // "Make my Duo Dance video · $9.99": the price is the cheapest pack that pays for this render
  // (credits in hand count), or its credit cost once the balance covers it.
  const templateCta = `templates.${templateId}.cta`;
  const ctaName = t.has(templateCta)
    ? t(templateCta)
    : t("templatePage.cta", { name: t(`templates.${templateId}.name`) });
  // Signed-out visitors hold no credits; a signed-in balance still loading quotes nothing yet.
  const heldCredits = signedIn ? balance : 0;
  const quote =
    heldCredits == null
      ? null
      : getVideoPurchaseQuote(creditsCost, heldCredits, getVideoPricing().packs);
  let ctaLabel = ctaName;
  if (quote?.kind === "pack") {
    ctaLabel = t("studio.ctaPrice", { label: ctaName, price: money(quote.pack.amountCents) });
  } else if (quote?.kind === "credits") {
    ctaLabel = t("studio.ctaCredits", { label: ctaName, cost: quote.credits });
  }
  let generateLabel = ctaLabel;
  if (pair.isSample) generateLabel = t("studio.viewSample");
  else if (createMutation.isPending) generateLabel = t("studio.submitting");

  useEffect(() => {
    onCtaLabelChange?.(ctaLabel);
  }, [ctaLabel, onCtaLabelChange]);

  // Rendering or buying needs the age and consent confirmation; the free sample preview doesn't.
  const needsConsent = !pair.isSample && !consented;

  return (
    <CreatorCard
      templateId={templateId}
      onTemplateChange={onTemplateChange}
      id={id}
      className={className}
      pair={pair}
      disabled={busy}
      showTemplateBar={!hideTemplateBar}
      beforeAction={
        pair.isSample ? null : (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-5 lg:leading-4">
            <Checkbox
              checked={consented}
              onCheckedChange={(checked) => setConsented(checked)}
              disabled={busy}
              className="mt-0.5"
            />
            <span>{t("studio.consentCheck")}</span>
          </label>
        )
      }
      primaryAction={
        notEnough ? (
          <Button
            type="button"
            size="lg"
            data-main-cta=""
            className="h-auto min-h-10 py-2 whitespace-normal"
            disabled={needsConsent}
            onClick={buyCreditsInstead}
          >
            {ctaLabel}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            data-main-cta=""
            className="h-auto min-h-10 py-2 whitespace-normal"
            disabled={busy || needsConsent || ((sessionPending || !hydrated) && !pair.isSample)}
            onClick={generate}
          >
            {createMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 aria-hidden="true" />
            )}
            {generateLabel}
          </Button>
        )
      }
      footer={
        <p className="text-muted-foreground mt-2 text-center text-xs text-balance">
          {/* Segments never break inside, so a wrapped line never starts with a "·". */}
          {t("studio.reassurance", {
            minutes: estimateRenderMinutes(templateId, quality, model),
          })
            .split(" · ")
            .map((segment, index, segments) => (
              <Fragment key={segment}>
                <span className="whitespace-nowrap">
                  {segment}
                  {index < segments.length - 1 ? " ·" : ""}
                </span>{" "}
              </Fragment>
            ))}
        </p>
      }
    >
      {compactOptions ? (
        <button
          type="button"
          aria-expanded={optionsOpen}
          aria-controls={id ? `${id}-options` : undefined}
          onClick={() => setOptionsOpen((open) => !open)}
          className="hover:bg-muted mt-4 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
        >
          <span className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="text-primary size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("studio.options.summary", {
                  version: t(`studio.version.${MODEL_TIER[model]}`),
                  quality: t(`studio.quality.${quality}`).split(" · ")[0] ?? quality,
                  aspect: videoTemplates[templateId].aspectRatio,
                })}
              </span>
              <span className="text-muted-foreground block text-xs">
                {optionsOpen ? t("studio.options.hide") : t("studio.options.change")}
              </span>
            </span>
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", optionsOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      ) : null}
      <div id={id ? `${id}-options` : undefined} hidden={!optionsOpen}>
        <fieldset className="mt-4" disabled={busy}>
          <legend className="mb-2 text-sm font-medium">{t("studio.version.label")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {models.map((option) => {
              const seconds = getVideoRenderSeconds(templateId, option);
              const fromCost = priceOf("480p", option);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={model === option}
                  onClick={() => chooseModel(option)}
                  className={cn(
                    "rounded-xl border px-2.5 py-2.5 text-left transition-colors disabled:opacity-60 sm:px-3",
                    model === option
                      ? "border-primary bg-primary/10 ring-primary ring-1"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {t(`studio.version.${MODEL_TIER[option]}`)}
                  </span>
                  <span className="block text-xs font-medium">
                    {isVideoHighlight(templateId, option)
                      ? t("studio.version.highlight", { seconds })
                      : t("studio.version.full", { seconds })}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {t("studio.version.from", { cost: fromCost })}
                  </span>
                </button>
              );
            })}
          </div>
          {highlightModel ? (
            // Always laid out (hidden for the full version) so switching versions never resizes the card.
            <p
              className={cn("text-muted-foreground mt-2 text-xs", !highlight && "invisible")}
              aria-hidden={!highlight}
            >
              {t("studio.version.highlightHint", {
                seconds: getVideoRenderSeconds(templateId, highlightModel),
                total: videoTemplates[templateId].durationSeconds,
              })}
            </p>
          ) : null}
        </fieldset>
        <fieldset className="mt-4" disabled={busy}>
          <legend className="mb-2 text-sm font-medium">{t("studio.quality.label")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {VIDEO_QUALITIES.map((option) => {
              // Labels read "720p · HD"; the tier name sits under the resolution on phones, beside it from sm up.
              const [resolution, tier] = t(`studio.quality.${option}`).split(" · ");
              // Every quality keeps its slot, so switching versions never reflows the grid.
              const available = isVideoModelQuality(model, option);
              const regularCost = available ? getVideoCreditsCost(option, templateId, model) : 0;
              const cost = available ? priceOf(option, model) : 0;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!available}
                  aria-pressed={quality === option}
                  onClick={() => setQuality(option)}
                  className={cn(
                    "rounded-xl border px-2.5 py-2.5 text-left transition-colors disabled:opacity-60 sm:px-3",
                    quality === option
                      ? "border-primary bg-primary/10 ring-primary ring-1"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-x-1.5">
                    <span className="text-sm font-semibold">{resolution}</span>
                    {tier ? <span className="text-xs font-medium">{tier}</span> : null}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {cost < regularCost ? <s className="mr-1">{regularCost}</s> : null}
                    {available
                      ? t("studio.quality.credits", { cost })
                      : t("studio.quality.premiumOnly")}
                  </span>
                  <span
                    className={cn("text-muted-foreground block text-xs", !available && "invisible")}
                    aria-hidden={!available}
                  >
                    {t("studio.quality.eta", {
                      // Unavailable qualities only hold the line's height; any model's estimate will do.
                      minutes: estimateRenderMinutes(
                        templateId,
                        option,
                        available ? model : "seedance-2.5",
                      ),
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Coins className="text-primary size-4" aria-hidden="true" />
          {pair.isSample ? t("studio.sampleFree") : t("studio.cost", { cost: creditsCost })}
          {!pair.isSample && firstFullApplied ? (
            <span className="text-primary text-xs">{t("studio.firstFull")}</span>
          ) : null}
        </span>
        {signedIn && balance != null ? (
          <span className="text-muted-foreground">{t("studio.balance", { balance })}</span>
        ) : null}
      </div>
    </CreatorCard>
  );
}

const CONSENT_STORAGE_KEY = "video-create-consent";

/** The consent checkbox, remembered for the browser session (e.g. across a checkout trip). */
function useSessionConsent() {
  const [consented, setConsentedState] = useState(false);
  useEffect(() => {
    try {
      setConsentedState(window.sessionStorage.getItem(CONSENT_STORAGE_KEY) === "1");
    } catch {
      // Storage can be blocked (private mode); the box then simply starts unchecked.
    }
  }, []);
  const setConsented = (next: boolean) => {
    setConsentedState(next);
    try {
      if (next) window.sessionStorage.setItem(CONSENT_STORAGE_KEY, "1");
      else window.sessionStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // Not remembered, still applied to this page.
    }
  };
  return [consented, setConsented] as const;
}
