import { type VideoTemplateId, isVideoTemplateId } from "@repo/app-config/video";

const LAST_TEMPLATE_KEY = "analytics.lastTemplate";

/** Remembers the template a visitor last worked with, so a later purchase can be attributed to it. */
export function rememberTemplate(templateId: VideoTemplateId) {
  try {
    window.localStorage.setItem(LAST_TEMPLATE_KEY, templateId);
  } catch {
    // Storage blocked: the purchase just goes unattributed.
  }
}

/** The template a purchase is attributed to, if the visitor worked with one in this browser. */
export function getAttributedTemplate(): VideoTemplateId | undefined {
  try {
    const value = window.localStorage.getItem(LAST_TEMPLATE_KEY);
    return isVideoTemplateId(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
