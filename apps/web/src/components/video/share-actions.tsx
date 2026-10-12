import type { VideoTemplateId } from "@repo/app-config/video";
import { Button } from "@repo/ui/button";
import { ExternalLink, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { webConfig } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { trackGoogleEvent } from "@/lib/analytics/google-analytics";

/** Web upload pages; browsers cannot hand them a file, so the clip is downloaded alongside. */
const UPLOAD_PAGES = [
  { key: "tiktok", url: "https://www.tiktok.com/upload" },
  { key: "instagram", url: "https://www.instagram.com/" },
  { key: "youtube", url: "https://www.youtube.com/upload" },
] as const;

type ShareMethod = "native" | (typeof UPLOAD_PAGES)[number]["key"];

/** True where the browser can pass a video file to the system share sheet (mostly phones). */
function canShareVideoFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) {
    return false;
  }
  return navigator.canShare({ files: [new File([], "clip.mp4", { type: "video/mp4" })] });
}

function copyCaption(caption: string) {
  // Instagram and TikTok drop shared text, so the caption goes to the clipboard to paste.
  navigator.clipboard?.writeText(caption).catch(() => undefined);
}

function startDownload(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
}

/**
 * Sharing for a finished clip. Phones get the system share sheet (Instagram, TikTok, …);
 * desktops get one click per platform that downloads the clip, copies the caption and
 * opens the platform's upload page.
 */
export function ShareActions({
  src,
  downloadHref,
  fileName,
  templateId,
  withSoundtrack,
}: {
  src: string;
  downloadHref: string;
  fileName: string;
  templateId: VideoTemplateId;
  withSoundtrack: boolean;
}) {
  const t = useTranslations("video.studio.result.share");
  const tTemplates = useTranslations("video.templates");
  const [nativeShare, setNativeShare] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const caption = t("caption", {
    name: tTemplates(`${templateId}.name`),
    site: new URL(webConfig.AppUrl).host,
    // Per-template hashtag(s) from the messages, e.g. "DuoDance #AIDance".
    tag: tTemplates(`${templateId}.hashtag`),
  });

  useEffect(() => {
    setNativeShare(canShareVideoFiles());
  }, []);

  // Load the file ahead of time: Safari only opens the share sheet straight from a tap.
  useEffect(() => {
    if (!nativeShare) {
      return;
    }
    let cancelled = false;
    setFile(null);
    fetch(src)
      .then((response) => response.blob())
      .then((blob) => {
        if (!cancelled) {
          setFile(new File([blob], fileName, { type: "video/mp4" }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNativeShare(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nativeShare, src, fileName]);

  const track = (method: ShareMethod) => {
    trackGoogleEvent("video_share", { method, template: templateId });
  };

  const shareNative = async () => {
    if (!file) {
      return;
    }
    copyCaption(caption);
    track("native");
    toast.success(t("captionCopied"));
    try {
      await navigator.share({ files: [file], text: caption });
    } catch (error) {
      // AbortError: the user closed the sheet.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(t("failed"));
      }
    }
  };

  const openUploadPage = (method: (typeof UPLOAD_PAGES)[number]) => {
    // Open the tab first so popup blockers still see the click.
    window.open(method.url, "_blank", "noopener,noreferrer");
    startDownload(downloadHref, fileName);
    copyCaption(caption);
    track(method.key);
    toast.success(t("desktopReady"), { duration: 8000 });
  };

  return (
    <div className="space-y-2 rounded-2xl border p-4">
      {nativeShare ? (
        <Button type="button" className="w-full" disabled={!file} onClick={shareNative}>
          <Share2 aria-hidden="true" />
          {file ? t("button") : t("preparing")}
        </Button>
      ) : (
        <>
          <p className="text-sm font-medium">{t("title")}</p>
          <div className="flex flex-wrap gap-2">
            {UPLOAD_PAGES.map((method) => (
              <Button
                key={method.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openUploadPage(method)}
              >
                {t(`platforms.${method.key}`)}
                <ExternalLink aria-hidden="true" />
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">{t("desktopHint")}</p>
        </>
      )}
      {withSoundtrack ? <p className="text-muted-foreground text-xs">{t("musicHint")}</p> : null}
    </div>
  );
}
