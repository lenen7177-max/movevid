/**
 * Video templates: what each one renders, which photos it takes and what it costs.
 *
 * Shared by web (template pages, studio, pricing) and server (validation, billing).
 * The server half of a template (reference clip, soundtrack, prompt) lives in
 * apps/server/src/video/templates.ts; marketing copy lives in the web i18n messages
 * under `video.templates.<id>`. Adding a template touches those three places.
 */

/** Output qualities a user can pick; each model renders a subset (see videoModels). */
export const VIDEO_QUALITIES = ["480p", "720p", "1080p"] as const;

export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

/**
 * Seedance models a user can pick, served through APIMart. APIMart bills reference + output
 * seconds; at the time of writing (USD per billed second):
 * - seedance-2.5: $0.0547 (480p), $0.1231 (720p), $0.2184 (1080p); clips up to 30s.
 * - seedance-2.0-fast: $0.0225 (480p), $0.0487 (720p); clips up to 15s.
 * Check https://apimart.ai for current prices and re-run the pricing test after changing them
 * (packages/app-config/src/__tests__/video-pricing.test.ts).
 */
export const VIDEO_MODELS = ["seedance-2.5", "seedance-2.0-fast"] as const;

export type VideoModel = (typeof VIDEO_MODELS)[number];

/** Seedance 2.0 models cap reference and output at 15s, so longer templates render their highlight cut. */
export const videoModels = {
  "seedance-2.5": { qualities: ["480p", "720p", "1080p"], highlight: false, offered: true },
  "seedance-2.0-fast": { qualities: ["480p", "720p"], highlight: true, offered: true },
} as const satisfies Record<
  VideoModel,
  { qualities: readonly VideoQuality[]; highlight: boolean; offered: boolean }
>;

type VideoLiteModel = Exclude<VideoModel, "seedance-2.5">;

type VideoLiteCredits = Record<VideoLiteModel, Record<"480p" | "720p", number>>;

/**
 * Template ids, oldest first. Each id needs a server entry (reference media + prompt) and
 * web copy under `video.templates.<id>`. The URL slug is the id with dashes (duo-dance).
 */
export const VIDEO_TEMPLATE_IDS = ["duo_dance", "solo_spotlight", "squad_walk"] as const;

export type VideoTemplateId = (typeof VIDEO_TEMPLATE_IDS)[number];

/** Photo slots in prompt order: the first used slot is @图片1, the next @图片2, … */
export const VIDEO_PHOTO_SLOTS = ["left", "middle", "right"] as const;

export type VideoPhotoSlot = (typeof VIDEO_PHOTO_SLOTS)[number];

export type VideoAspectRatio = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";

type VideoTemplateShape = {
  /**
   * Day the template went live, as YYYY-MM-DD. Fixed on purpose: it is the VideoObject
   * uploadDate and the sitemap <lastmod> of the template page, which must not move on rebuilds.
   */
  launchDate: string;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  /** Which photos the template casts, in prompt order. */
  slots: readonly VideoPhotoSlot[];
  /**
   * Fewest photos a render accepts (default: every slot). Uploads fill the slots in order,
   * and the prompt decides what happens to the empty places.
   */
  minPhotos?: number;
  /** Pet photos work too (cats, dogs…), not only people; shown as a hint next to the uploads. */
  allowsPets?: boolean;
  /** Whether finished renders get the template's soundtrack muxed in the browser. */
  soundtrack: boolean;
  /**
   * Length of the highlight cut that Seedance 2.0 models render when the full clip is over 15s.
   * Templates without one are short enough for every model to render in full.
   */
  highlightSeconds?: number;
  /** Overrides videoConfig.qualities (seedance-2.5) for this template. */
  creditsCost?: Record<VideoQuality, number>;
  /** Overrides videoConfig.liteCredits (Seedance 2.0 models) for this template. */
  liteCreditsCost?: VideoLiteCredits;
  /** Models the template can be rendered with (default: all of them). */
  models?: readonly VideoModel[];
};

/** Output shape and price per template. */
export const videoTemplates = {
  // Two friends, one routine: a 20s vertical dance with a 12s highlight for Seedance 2.0.
  duo_dance: {
    launchDate: "2026-01-01",
    aspectRatio: "9:16",
    durationSeconds: 20,
    slots: ["left", "right"],
    soundtrack: true,
    highlightSeconds: 12,
  },
  // One person (or a pet) owns the stage: a 10s vertical spotlight moment.
  solo_spotlight: {
    launchDate: "2026-01-01",
    aspectRatio: "9:16",
    durationSeconds: 10,
    slots: ["left"],
    allowsPets: true,
    soundtrack: true,
    creditsCost: { "480p": 30, "720p": 60, "1080p": 105 },
    liteCreditsCost: { "seedance-2.0-fast": { "480p": 15, "720p": 25 } },
  },
  // One to three friends walk toward the camera in slow motion, 12s widescreen.
  squad_walk: {
    launchDate: "2026-01-15",
    aspectRatio: "16:9",
    durationSeconds: 12,
    slots: ["left", "middle", "right"],
    minPhotos: 1,
    soundtrack: true,
    creditsCost: { "480p": 35, "720p": 70, "1080p": 125 },
  },
} as const satisfies Record<VideoTemplateId, VideoTemplateShape>;

/**
 * The only template when the site ships exactly one. The home page then is that template's
 * landing page and /templates/<slug> redirects to it, so the same page never has two URLs.
 */
export const SINGLE_TEMPLATE_ID: VideoTemplateId | null =
  (VIDEO_TEMPLATE_IDS as readonly VideoTemplateId[]).length === 1 ? VIDEO_TEMPLATE_IDS[0] : null;

/** Launch date of the newest template (YYYY-MM-DD), for pages that list every template. */
export function latestVideoTemplateLaunchDate(): string {
  return (
    VIDEO_TEMPLATE_IDS.map((id) => videoTemplates[id].launchDate)
      .sort()
      .at(-1) ?? ""
  );
}

export function isVideoTemplateId(value: unknown): value is VideoTemplateId {
  return typeof value === "string" && (VIDEO_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function isVideoModel(value: unknown): value is VideoModel {
  return typeof value === "string" && (VIDEO_MODELS as readonly string[]).includes(value);
}

/** Settings shared by web and server. */
export const videoConfig = {
  // The studio's starting template (the oldest one), so deleting a template never breaks it.
  defaultTemplateId: VIDEO_TEMPLATE_IDS[0] as VideoTemplateId,
  // seedance-2.5 credits per render, by quality, for templates without their own creditsCost
  // (sized for a 20s clip). Refunded automatically when the render fails.
  qualities: {
    "480p": { creditsCost: 55 },
    "720p": { creditsCost: 115 },
    "1080p": { creditsCost: 205 },
  } satisfies Record<VideoQuality, { creditsCost: number }>,
  // Seedance 2.0 credits for templates without their own liteCreditsCost (up to 15s).
  liteCredits: {
    "seedance-2.0-fast": { "480p": 15, "720p": 30 },
  } satisfies VideoLiteCredits,
  // An account's first full video (seedance-2.5 at 480p) costs at most this many credits, so the
  // smallest pack makes one. It runs below the margin floor on purpose, as an acquisition cost;
  // refunded renders give the offer back. Set to null to turn the offer off.
  firstFullCredits: 30 as number | null,
  // What the create form starts on.
  defaultModel: "seedance-2.0-fast" as VideoModel,
  defaultQuality: "480p" as VideoQuality,
  maxImageBytes: 20 * 1024 * 1024,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** Whether the template also takes pet photos (cats, dogs…), not only people. */
export function videoTemplateAllowsPets(templateId: VideoTemplateId): boolean {
  const template: VideoTemplateShape = videoTemplates[templateId];
  return template.allowsPets ?? false;
}

/** Fewest photos the template accepts; most templates need every slot filled. */
export function getVideoMinPhotos(templateId: VideoTemplateId): number {
  const template: VideoTemplateShape = videoTemplates[templateId];
  return template.minPhotos ?? template.slots.length;
}

/** Models offered for the template, in VIDEO_MODELS order. */
export function getVideoTemplateModels(templateId: VideoTemplateId): readonly VideoModel[] {
  const template: VideoTemplateShape = videoTemplates[templateId];
  return (template.models ?? VIDEO_MODELS).filter((model) => videoModels[model].offered);
}

export function isVideoModelQuality(model: VideoModel, quality: VideoQuality): boolean {
  const qualities: readonly VideoQuality[] = videoModels[model].qualities;
  return qualities.includes(quality);
}

/** Whether the model renders the template's highlight cut instead of the full clip. */
export function isVideoHighlight(templateId: VideoTemplateId, model: VideoModel): boolean {
  const template: VideoTemplateShape = videoTemplates[templateId];
  return videoModels[model].highlight && template.highlightSeconds != null;
}

/** Length of the video the model renders for the template. */
export function getVideoRenderSeconds(templateId: VideoTemplateId, model: VideoModel): number {
  const template: VideoTemplateShape = videoTemplates[templateId];
  return isVideoHighlight(templateId, model)
    ? (template.highlightSeconds ?? template.durationSeconds)
    : template.durationSeconds;
}

/** Credits for one render. Throws for a quality the model does not render (see isVideoModelQuality). */
export function getVideoCreditsCost(
  quality: VideoQuality,
  templateId: VideoTemplateId = videoConfig.defaultTemplateId,
  model: VideoModel = "seedance-2.5",
): number {
  const template: VideoTemplateShape = videoTemplates[templateId];
  if (model === "seedance-2.5") {
    return template.creditsCost?.[quality] ?? videoConfig.qualities[quality].creditsCost;
  }
  if (quality === "1080p") throw new Error(`${model} does not render 1080p`);
  return (template.liteCreditsCost ?? videoConfig.liteCredits)[model][quality];
}

/**
 * Credits for this render when it is the account's first full video, or null when the offer
 * doesn't apply (turned off, not seedance-2.5 at 480p, or the template already costs no more).
 */
export function getVideoFirstFullCredits(
  quality: VideoQuality,
  templateId: VideoTemplateId,
  model: VideoModel,
): number | null {
  const offer = videoConfig.firstFullCredits;
  if (offer == null || model !== "seedance-2.5" || quality !== "480p") return null;
  const regular = getVideoCreditsCost(quality, templateId, model);
  return regular > offer ? offer : null;
}

/**
 * Full videos (seedance-2.5 at 480p) that `credits` pay for on the template. With `firstFull`
 * (an account that hasn't kept a full video yet) the first one is priced at the first-full offer,
 * so the 30-credit starter pack makes exactly one.
 */
export function getVideoFullCountForCredits(
  credits: number,
  {
    templateId = videoConfig.defaultTemplateId,
    firstFull = false,
  }: { templateId?: VideoTemplateId; firstFull?: boolean } = {},
): number {
  const regular = getVideoCreditsCost("480p", templateId, "seedance-2.5");
  const first =
    (firstFull ? getVideoFirstFullCredits("480p", templateId, "seedance-2.5") : null) ?? regular;
  if (regular <= 0 || credits < first) return 0;
  return 1 + Math.floor((credits - first) / regular);
}

/** Fast videos (seedance-2.0-fast at 480p) that `credits` pay for on the template. */
export function getVideoFastCountForCredits(
  credits: number,
  templateId: VideoTemplateId = videoConfig.defaultTemplateId,
): number {
  const cost = getVideoCreditsCost("480p", templateId, "seedance-2.0-fast");
  return cost > 0 ? Math.floor(credits / cost) : 0;
}

/** A credit pack as the storefront shows it: credits delivered and the price in cents. */
export type VideoPackOffer = { id: string; credits: number; amountCents: number };

/**
 * What the create button quotes for a render that costs `cost` credits: the credits themselves
 * when the balance covers them, else the cheapest pack that makes up the shortfall (buying it
 * pays for this render), or null when no pack is big enough.
 */
export function getVideoPurchaseQuote(
  cost: number,
  balance: number,
  packs: readonly VideoPackOffer[],
): { kind: "credits"; credits: number } | { kind: "pack"; pack: VideoPackOffer } | null {
  if (balance >= cost) return { kind: "credits", credits: cost };
  const shortfall = cost - Math.max(0, balance);
  const pack = packs
    .filter((option) => option.credits >= shortfall)
    .reduce<VideoPackOffer | null>(
      (best, option) => (best && best.amountCents <= option.amountCents ? best : option),
      null,
    );
  return pack ? { kind: "pack", pack } : null;
}
