import { describe, expect, it } from "vitest";
import { resolveWebCommonConfig } from "../app-config";
import {
  SINGLE_TEMPLATE_ID,
  VIDEO_MODELS,
  VIDEO_TEMPLATE_IDS,
  type VideoModel,
  type VideoQuality,
  videoModels,
  videoTemplates,
  getVideoCreditsCost,
  getVideoFastCountForCredits,
  getVideoFullCountForCredits,
  getVideoPurchaseQuote,
  getVideoRenderSeconds,
  isVideoHighlight,
  isVideoModelQuality,
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
    for (const templateId of VIDEO_TEMPLATE_IDS) {
      const template: { durationSeconds: number; highlightSeconds?: number } =
        videoTemplates[templateId];
      for (const model of VIDEO_MODELS) {
        const label = `${templateId} ${model}`;
        // Short templates have no highlight: every model renders them in full.
        const highlight = videoModels[model].highlight && template.highlightSeconds != null;
        expect(isVideoHighlight(templateId, model), label).toBe(highlight);
        expect(getVideoRenderSeconds(templateId, model), label).toBe(
          highlight ? template.highlightSeconds : template.durationSeconds,
        );
      }
    }
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

  it("counts full videos per pack with the first-full offer applied once", () => {
    // MoveVid's default template (ai_celebrity_autograph) costs 30 credits at 480p, the same as
    // the first-full offer, so the offer never lowers it: every full video is 30 credits.
    expect(getVideoFullCountForCredits(29, { firstFull: true })).toBe(0);
    expect(getVideoFullCountForCredits(30, { firstFull: true })).toBe(1);
    expect(getVideoFullCountForCredits(59, { firstFull: true })).toBe(1);
    expect(getVideoFullCountForCredits(60, { firstFull: true })).toBe(2);
    expect(getVideoFullCountForCredits(30)).toBe(1);
    expect(getVideoFullCountForCredits(110)).toBe(3);
    expect(getVideoFastCountForCredits(30)).toBe(2);
  });

  it("keeps the starter pack's '1 full video or 2 quick 480p videos' claim true", () => {
    // The pricing cards feature this pack with that headline (apps/web pricing-page.tsx).
    const starter = packs.find((pack) => pack.id === "starter");
    expect(starter).toBeDefined();
    expect(getVideoFullCountForCredits(starter?.credits ?? 0, { firstFull: true })).toBe(1);
    expect(getVideoFastCountForCredits(starter?.credits ?? 0)).toBe(2);
  });

  it("rejects 1080p on models that don't render it", () => {
    for (const templateId of VIDEO_TEMPLATE_IDS) {
      for (const model of VIDEO_MODELS) {
        if (isVideoModelQuality(model, "1080p")) continue;
        expect(() => getVideoCreditsCost("1080p", templateId, model), model).toThrow();
      }
    }
  });
});

describe("create button quote", () => {
  const offers = packs.map((pack) => ({
    id: pack.id,
    credits: pack.credits,
    amountCents: Math.round(pack.price * 100),
  }));

  it("quotes the starter pack for the default selection of a new visitor", () => {
    const cost = getVideoCreditsCost("480p", "ai_celebrity_autograph", "seedance-2.0-fast");
    expect(getVideoPurchaseQuote(cost, 0, offers)).toEqual({
      kind: "pack",
      pack: { id: "starter", credits: 30, amountCents: 999 },
    });
  });

  it("quotes credits when the balance covers the render", () => {
    expect(getVideoPurchaseQuote(15, 15, offers)).toEqual({ kind: "credits", credits: 15 });
  });

  it("quotes the cheapest pack that covers the shortfall, never one too small", () => {
    // 205 credits with none in hand: only the 250-credit pack pays for it.
    expect(getVideoPurchaseQuote(205, 0, offers)).toMatchObject({ pack: { credits: 250 } });
    // With 120 in hand the 100-credit pack makes up the rest.
    expect(getVideoPurchaseQuote(205, 120, offers)).toMatchObject({ pack: { credits: 100 } });
    // Packs come in any order; the cheapest that covers wins.
    const reversed = [...offers].reverse();
    expect(getVideoPurchaseQuote(20, 0, reversed)).toMatchObject({ pack: { id: "starter" } });
    for (const cost of [1, 15, 30, 55, 115, 205]) {
      const quote = getVideoPurchaseQuote(cost, 0, offers);
      if (quote?.kind === "pack") expect(quote.pack.credits).toBeGreaterThanOrEqual(cost);
    }
  });

  it("quotes nothing when no pack is big enough", () => {
    expect(getVideoPurchaseQuote(10_000, 0, offers)).toBeNull();
  });
});

describe("video templates", () => {
  it("gives every template a real YYYY-MM-DD launch date that isn't in the future", () => {
    for (const templateId of VIDEO_TEMPLATE_IDS) {
      const { launchDate } = videoTemplates[templateId];
      expect(launchDate, templateId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const day = new Date(`${launchDate}T00:00:00Z`);
      expect(day.toISOString().slice(0, 10), templateId).toBe(launchDate);
      expect(day.getTime(), templateId).toBeLessThanOrEqual(Date.now());
    }
  });

  it("keeps every template on its own /templates/<slug> page (MoveVid is a hub)", () => {
    expect(SINGLE_TEMPLATE_ID).toBeNull();
  });
});
