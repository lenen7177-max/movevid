import { Button } from "@repo/ui/button";
import { Progress } from "@repo/ui/progress";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/i18n";
import { renderProgress } from "@/lib/video/render-eta";
import { templateAspectClass } from "@/lib/video/templates";
import { cn } from "@/lib/utils";
import type { orpc } from "@/utils/orpc";

type VideoJob = Awaited<ReturnType<typeof orpc.video.get.call>>;

const STEP_KEYS = ["review", "render", "music"] as const;
const TIP_KEYS = ["leave", "share", "quality", "templates"] as const;
const TIP_SECONDS = 8;
// Set per job when the user asked for a browser notification; read when the render settles.
const ALERT_KEY_PREFIX = "render-alert:";

function readAlertFlag(jobId: string): boolean {
  try {
    return sessionStorage.getItem(`${ALERT_KEY_PREFIX}${jobId}`) === "1";
  } catch {
    return false;
  }
}

function writeAlertFlag(jobId: string) {
  try {
    sessionStorage.setItem(`${ALERT_KEY_PREFIX}${jobId}`, "1");
  } catch {
    // Private mode: the notification is skipped, the render is unaffected.
  }
}

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current time, refreshed every `intervalMs` while active (null pauses it). */
function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function NotifyButton({ jobId }: { jobId: string }) {
  const t = useTranslations("video.studio.result.wait");
  const [enabled, setEnabled] = useState(() => readAlertFlag(jobId));
  const [supported] = useState(notificationsSupported);

  if (!supported || Notification.permission === "denied") return null;
  if (enabled) {
    return (
      <p className="text-primary flex items-center gap-1.5 text-xs font-medium">
        <BellRing className="size-3.5" aria-hidden="true" />
        {t("notifyOn")}
      </p>
    );
  }

  const enable = async () => {
    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return;
    writeAlertFlag(jobId);
    setEnabled(true);
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void enable()}>
      <Bell aria-hidden="true" />
      {t("notify")}
    </Button>
  );
}

/** The waiting state of a render: time-based progress, steps, and what to do meanwhile. */
export function RenderProgress({ job }: { job: VideoJob }) {
  const t = useTranslations("video.studio.result");
  const tWait = useTranslations("video.studio.result.wait");
  const now = useNow(1000);
  const { percent, elapsedSeconds, remainingSeconds } = renderProgress(job, now);
  const reviewing = job.phase === "reviewing";
  const currentStep = reviewing ? 0 : 1;
  const tipKey = TIP_KEYS[Math.floor(elapsedSeconds / TIP_SECONDS) % TIP_KEYS.length];

  let remainingLabel = tWait("slower");
  if (remainingSeconds > 90) {
    remainingLabel = tWait("remaining", { minutes: Math.ceil(remainingSeconds / 60) });
  } else if (remainingSeconds > 0) {
    remainingLabel = tWait("almostDone");
  }

  return (
    <div
      className={cn(
        "hero-glow bg-card flex flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center",
        templateAspectClass(job.templateId),
      )}
    >
      <ol className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-medium">
        {STEP_KEYS.map((key, index) => (
          <li
            key={key}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap",
              index < currentStep && "bg-primary/10 text-primary",
              index === currentStep && "bg-primary text-primary-foreground",
              index > currentStep && "bg-background/60 text-muted-foreground",
            )}
            aria-current={index === currentStep ? "step" : undefined}
          >
            {index < currentStep ? <Check className="size-3" aria-hidden="true" /> : null}
            {index === currentStep ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : null}
            {index > currentStep ? <span className="tabular-nums">{index + 1}</span> : null}
            {tWait(`steps.${key}`)}
          </li>
        ))}
      </ol>

      <div className="w-full max-w-sm space-y-2">
        <p className="font-semibold" aria-live="polite">
          {reviewing ? t("reviewing") : t("processing", { progress: percent })}
        </p>
        <Progress value={percent} className="w-full" />
        <p className="text-muted-foreground flex justify-between text-xs tabular-nums">
          <span>{tWait("elapsed", { time: formatElapsed(elapsedSeconds) })}</span>
          <span>{remainingLabel}</span>
        </p>
      </div>

      <NotifyButton jobId={job.id} />

      <p className="text-muted-foreground max-w-sm text-sm">
        {reviewing ? t("reviewingHint") : tWait(`tips.${tipKey}`)}
      </p>
      <p className="text-muted-foreground max-w-sm text-xs">{tWait("refundNote")}</p>
    </div>
  );
}

/**
 * Keeps the tab title on the render's progress, and when the render this tab was watching
 * settles, marks the tab and shows a browser notification if the user asked for one.
 */
export function useRenderAlerts(job: VideoJob | undefined) {
  const tWait = useTranslations("video.studio.result.wait");
  const tTemplates = useTranslations("video.templates");
  const processing = job?.status === "processing";
  const now = useNow(processing ? 1000 : null);
  const baseTitleRef = useRef<string | null>(null);
  const watchedJobRef = useRef<string | null>(null);
  // Undoes the "done" tab title; kept across re-renders so refetches don't cancel it.
  const pendingRestoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!job || job.status !== "processing") return;
    watchedJobRef.current = job.id;
    baseTitleRef.current ??= document.title;
    document.title = tWait("tabProcessing", { percent: renderProgress(job, now).percent });
  }, [job, now, tWait]);

  useEffect(() => {
    if (!job || job.status === "processing" || watchedJobRef.current !== job.id) return;
    watchedJobRef.current = null;
    const succeeded = job.status === "succeeded";
    const baseTitle = baseTitleRef.current ?? document.title;
    baseTitleRef.current = null;
    document.title = succeeded ? tWait("tabDone") : tWait("tabFailed");

    let timer = 0;
    const cancel = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", restoreTitle);
      pendingRestoreRef.current = null;
    };
    // Back on the tab (or 5 s later if it was already visible), the page title returns.
    const restoreTitle = () => {
      if (document.hidden) return;
      document.title = baseTitle;
      cancel();
    };
    document.addEventListener("visibilitychange", restoreTitle);
    timer = window.setTimeout(restoreTitle, 5000);
    pendingRestoreRef.current = cancel;

    if (
      document.hidden &&
      readAlertFlag(job.id) &&
      notificationsSupported() &&
      Notification.permission === "granted"
    ) {
      const notification = new Notification(
        succeeded ? tWait("notifyDoneTitle") : tWait("notifyFailedTitle"),
        {
          body: succeeded
            ? tWait("notifyDoneBody", { template: tTemplates(`${job.templateId}.name`) })
            : tWait("notifyFailedBody"),
          icon: "/pwa/pwa-192x192.png",
          tag: job.id,
        },
      );
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [job, tWait, tTemplates]);

  // Leaving the studio puts the original title back and drops any pending title change.
  useEffect(
    () => () => {
      pendingRestoreRef.current?.();
      if (baseTitleRef.current) document.title = baseTitleRef.current;
    },
    [],
  );
}
