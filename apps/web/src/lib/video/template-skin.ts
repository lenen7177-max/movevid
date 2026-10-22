import { type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import type { CSSProperties } from "react";

/**
 * A template page's own look, so each page reads like its trend instead of a generic product
 * page (visitors decide on impulse). Everything is optional; a template without a skin keeps
 * the site theme.
 *
 * Copy that goes with a skin lives in the web messages under `video.templates.<id>`:
 * - `h1Accent`: a second H1 line in the accent color ("Someone is watching you eat.")
 * - `ticker`: short phrases for the strip under the hero (["One photo", "11 seconds", …])
 * - `frameBadge`: the label on the phone frame ("Live · Fan meet")
 */
export type TemplateSkin = {
  /** Buttons, rings, links and the hero glow on the template page. Any CSS color. */
  accent: string;
  /** Text on accent backgrounds. */
  accentForeground: string;
  /** Second color for the H1 accent line and the ticker separators. Defaults to `accent`. */
  accent2?: string;
  /** "poster": condensed uppercase display type (Anton) for the H1 and section titles. */
  font?: "poster";
  /** "phone": the hero preview sits in a phone-recording frame with a live badge. */
  frame?: "phone";
};

/** Skins by template. Templates left out use the site theme. */
export const TEMPLATE_SKINS: Partial<Record<VideoTemplateId, TemplateSkin>> = {
  // Fan-cam look: filmed on a fan's phone at the signing table, pink and gold.
  ai_celebrity_autograph: {
    accent: "#FF4FA3",
    accentForeground: "#1A0712",
    accent2: "#FFC24B",
    font: "poster",
    frame: "phone",
  },
};

/**
 * Day each template page's content was last reviewed (YYYY-MM-DD), shown as "Updated …".
 * Defaults to the launch date. Move it when the copy, samples or trend facts change.
 */
export const TEMPLATE_UPDATED: Partial<Record<VideoTemplateId, string>> = {
  ai_celebrity_autograph: "2026-10-23",
};

export function templateSkin(templateId: VideoTemplateId): TemplateSkin | null {
  return TEMPLATE_SKINS[templateId] ?? null;
}

export function templateUpdatedDate(templateId: VideoTemplateId): string {
  return TEMPLATE_UPDATED[templateId] ?? videoTemplates[templateId].launchDate;
}

/** CSS variables that re-theme the page subtree (the header and footer keep the site theme). */
export function templateSkinStyle(skin: TemplateSkin | null): CSSProperties | undefined {
  if (!skin) return undefined;
  const accent2 = skin.accent2 ?? skin.accent;
  return {
    "--primary": skin.accent,
    "--primary-foreground": skin.accentForeground,
    "--ring": skin.accent,
    "--glow": `color-mix(in oklch, ${skin.accent} 26%, transparent)`,
    "--skin-accent-2": accent2,
  } as CSSProperties;
}
