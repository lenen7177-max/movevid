import { getVideoPricing } from "@/lib/video/pricing";
import { getAttributedTemplate } from "./attribution";
import { trackGoogleEvent } from "./google-analytics";

/**
 * Conversion events for GA4. Names follow GA4's recommended events where one exists
 * (sign_up, login, begin_checkout, purchase) so revenue and funnels work out of the box;
 * the video_* events cover the product steps in between.
 *
 * Funnel: page_view → sign_up/login → video_generate_start → video_generate_complete
 *         → begin_checkout → purchase (and video_share after a render).
 */

const ONCE_KEY_PREFIX = "analytics.once:";

/** True the first time a key is seen in this browser; later calls return false. */
function firstTime(key: string): boolean {
  try {
    const storageKey = `${ONCE_KEY_PREFIX}${key}`;
    if (window.localStorage.getItem(storageKey)) return false;
    window.localStorage.setItem(storageKey, "1");
    return true;
  } catch {
    // Storage blocked: send anyway rather than lose the event.
    return true;
  }
}

/** Fires once per user per browser session; sign_up when the account was created moments ago. */
export function trackAuthSession(user: { id: string; createdAt: Date | string }) {
  try {
    const key = `analytics.auth:${user.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: fall through and send once for this page load.
  }
  const ageMs = Date.now() - new Date(user.createdAt).getTime();
  const isNewAccount = ageMs >= 0 && ageMs < 10 * 60 * 1000;
  if (isNewAccount) {
    if (firstTime(`sign_up:${user.id}`)) trackGoogleEvent("sign_up");
  } else {
    trackGoogleEvent("login");
  }
}

export function trackSampleView(templateId: string) {
  trackGoogleEvent("video_view_sample", { template: templateId });
}

export function trackGenerateStart(input: {
  jobId: string;
  templateId: string;
  quality: string;
  model: string;
  credits: number;
}) {
  trackGoogleEvent("video_generate_start", {
    job_id: input.jobId,
    template: input.templateId,
    quality: input.quality,
    model: input.model,
    credits: input.credits,
  });
}

/** Reports a job's outcome once, whenever the browser first sees it finished. */
export function trackGenerateResult(job: {
  id: string;
  status: string;
  templateId: string;
  quality: string;
  model: string;
  createdAt: string;
  errorCode?: string | null;
}) {
  if (job.status !== "succeeded" && job.status !== "failed") return;
  // Old renders opened later from the history are not new outcomes.
  if (Date.now() - new Date(job.createdAt).getTime() > 24 * 60 * 60 * 1000) return;
  if (!firstTime(`job:${job.id}`)) return;
  trackGoogleEvent(
    job.status === "succeeded" ? "video_generate_complete" : "video_generate_failed",
    {
      job_id: job.id,
      template: job.templateId,
      quality: job.quality,
      model: job.model,
      ...(job.errorCode ? { reason: job.errorCode } : {}),
    },
  );
}

type Item = {
  id: string;
  name: string;
  cents: number;
  currency: string;
  kind: "credits" | "subscription";
};

function ecommerce(item: Item) {
  const value = item.cents / 100;
  const template = getAttributedTemplate();
  return {
    // Custom parameter: the template the buyer last worked with (register it in GA as a dimension).
    ...(template ? { template } : {}),
    currency: item.currency.toUpperCase(),
    value,
    items: [
      {
        item_id: item.id,
        item_name: item.name,
        item_category: item.kind,
        price: value,
        quantity: 1,
      },
    ],
  };
}

export function trackBeginCheckout(item: Item) {
  trackGoogleEvent("begin_checkout", ecommerce(item));
}

/** begin_checkout for a credit pack, priced from app-config. */
export function trackCreditPackCheckout(packageId: string) {
  const pack = getVideoPricing().packs.find((item) => item.id === packageId);
  if (!pack) return;
  trackBeginCheckout({
    id: pack.id,
    name: `${pack.credits} credits`,
    cents: pack.amountCents,
    currency: "usd",
    kind: "credits",
  });
}

/** GA4 purchase with revenue; the transaction id also lets GA drop duplicates. */
export function trackPurchase(transactionId: string, item: Item) {
  if (!firstTime(`purchase:${transactionId}`)) return;
  trackGoogleEvent("purchase", { transaction_id: transactionId, ...ecommerce(item) });
}
