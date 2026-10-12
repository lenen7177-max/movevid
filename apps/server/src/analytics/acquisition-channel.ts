/** Channels shown in admin reports. "referral" is any other site, "direct" means no source. */
export const ACQUISITION_CHANNELS = [
  "chatgpt",
  "perplexity",
  "gemini",
  "claude",
  "copilot",
  "google",
  "bing",
  "yandex",
  "duckduckgo",
  "baidu",
  "x",
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "reddit",
  "referral",
  "direct",
] as const;

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

// Checked in order: AI assistants before the search engines that host them (gemini.google.com).
const HOST_CHANNELS: Array<[RegExp, AcquisitionChannel]> = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$|^chatgpt$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$|^perplexity$/, "perplexity"],
  [/(^|\.)(gemini|bard)\.google\.com$|^gemini$/, "gemini"],
  [/(^|\.)claude\.ai$|^claude$/, "claude"],
  [/(^|\.)copilot\.microsoft\.com$|^copilot$/, "copilot"],
  [/(^|\.)google\.[a-z.]+$|^google$/, "google"],
  [/(^|\.)bing\.com$|^bing$/, "bing"],
  [/(^|\.)yandex\.[a-z.]+$|^yandex$/, "yandex"],
  [/(^|\.)duckduckgo\.com$|^duckduckgo$/, "duckduckgo"],
  [/(^|\.)baidu\.com$|^baidu$/, "baidu"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$|^(x|twitter)$/, "x"],
  [/(^|\.)tiktok\.com$|^tiktok$/, "tiktok"],
  [/(^|\.)instagram\.com$|^(instagram|ig)$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^(facebook|fb)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$|^youtube$/, "youtube"],
  [/(^|\.)reddit\.com$|^reddit$/, "reddit"],
];

function matchChannel(value: string): AcquisitionChannel | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (!normalized) return null;
  for (const [pattern, channel] of HOST_CHANNELS) {
    if (pattern.test(normalized)) return channel;
  }
  return null;
}

/**
 * Maps a first visit to a channel. An explicit utm_source wins over the referrer (ChatGPT adds
 * utm_source=chatgpt.com, and our own campaign links carry one); any other referrer is "referral".
 */
export function classifyAcquisitionChannel(input: {
  referrerHost?: string | null;
  utmSource?: string | null;
}): AcquisitionChannel {
  const fromUtm = input.utmSource ? matchChannel(input.utmSource) : null;
  if (fromUtm) return fromUtm;
  const fromReferrer = input.referrerHost ? matchChannel(input.referrerHost) : null;
  if (fromReferrer) return fromReferrer;
  if (input.referrerHost?.trim() || input.utmSource?.trim()) return "referral";
  return "direct";
}
