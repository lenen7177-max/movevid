import { describe, expect, it } from "vitest";
import { resolveWebCommonConfig } from "../app-config";
import {
  VIDEO_MODELS,
  VIDEO_TEMPLATE_IDS,
  type VideoModel,
  type VideoQuality,
  videoModels,
  videoTemplates,
  getVideoCreditsCost,
  getVideoRenderSeconds,
  isVideoHighlight,
} from "../video";

// APIMart USD per billed second (reference + output). Update when your provider prices change.
const RATE: Record<VideoModel, Partial<Record<VideoQuality, number>>> = {
  "seedance-2.5": { "480p": 0.0547, "720p": 0.1231, "1080p": 0.2184 },
  "seedance-2.0-fast": { "480p": 0.0225, "720p": 0.0487 },
};

// Stripe fee for international cards: 3.9% + $0.30.
const stripeFee = (price: number) => price * 0.039 + 0.3;

// Every credit pack on sale.
const packs = (resolveWebCommonConfig().credits?.packages ?? []).flatMap((pack) =>
  pack.web ? [{ id: pack.id, credits: pack.amount, price: pack.web.amountCents / 100 }] : [],
);

/** Gross margin of one render bought with `pack` credits, after the Stripe fee. */
function margin(cost: number, credits: number, pack: { credits: number; price: number }) {
  const revenue = (credits / pack.credits) * pack.price;
  const fee = (credits / pack.credits) * stripeFee(pack.price);
  return (revenue - fee - cost) / revenue;
}

describe("video pricing", () => {
  it("keeps at least 80% gross margin for every template, model, quality and pack", () => {
    expect(packs.length).toBeGreaterThan(2);
    for (const templateId of VIDEO_TEMPLATE_IDS) {
      for (const model of VIDEO_MODELS) {
        for (const quality of videoModels[model].qualities) {
          const seconds = getVideoRenderSeconds(templateId, model);
          // The reference clip is as long as the output (full clips are within 0.4s of it).
          const cost = seconds * 2 * (RATE[model][quality] ?? Number.POSITIVE_INFINITY);
          const credits = getVideoCreditsCost(quality, templateId, model);
          for (const pack of packs) {
            expect(
              margin(cost, credits, pack),
              `${templateId} ${model} ${quality} via ${pack.id}`,
            ).toBeGreaterThanOrEqual(0.8);
          }
        }
      }
    }
  });

  it("keeps Seedance 2.0 renders within its 15s reference and output cap", () => {
    for (const templateId of VIDEO_TEMPLATE_IDS) {
      for (const model of VIDEO_MODELS) {
        if (!videoModels[model].highlight) continue;
        expect(
          getVideoRenderSeconds(templateId, model),
          `${templateId} ${model}`,
        ).toBeLessThanOrEqual(15);
      }
    }
  });

  it("renders the full clip on seedance-2.5 and the highlight cut on 2.0 models", () => {
    expect(isVideoHighlight("duo_dance", "seedance-2.5")).toBe(false);
    expect(getVideoRenderSeconds("duo_dance", "seedance-2.5")).toBe(
      videoTemplates.duo_dance.durationSeconds,
    );
    expect(isVideoHighlight("duo_dance", "seedance-2.0-fast")).toBe(true);
    expect(getVideoRenderSeconds("duo_dance", "seedance-2.0-fast")).toBe(12);
    // Short templates have no highlight: every model renders them in full.
    expect(isVideoHighlight("solo_spotlight", "seedance-2.0-fast")).toBe(false);
    expect(getVideoRenderSeconds("solo_spotlight", "seedance-2.0-fast")).toBe(10);
  });

  it("lets the smallest pack buy a fast render on every template", () => {
    const smallest = [...packs].sort((a, b) => a.price - b.price)[0];
    expect(smallest).toBeDefined();
    for (const templateId of VIDEO_TEMPLATE_IDS) {
      expect(getVideoCreditsCost("480p", templateId, "seedance-2.0-fast")).toBeLessThanOrEqual(
        smallest?.credits ?? 0,
      );
    }
  });

  it("rejects 1080p on Seedance 2.0 models", () => {
    expect(() => getVideoCreditsCost("1080p", "duo_dance", "seedance-2.0-fast")).toThrow();
  });
});
