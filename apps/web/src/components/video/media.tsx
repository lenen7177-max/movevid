import type { VideoTemplateId } from "@repo/app-config/video";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { templatePoster, templatePreviewVideo } from "@/lib/video/templates";
import { cn } from "@/lib/utils";

type CaseVideoProps = {
  src: string;
  poster?: string;
  label: string;
  /** Shown on the poster, e.g. "Highlight · 12 s" when the clip switches with the version. */
  badge?: string;
  className?: string;
};

/** Poster with a play button. The clip starts only after a click. */
export function CaseVideo({ src, poster, label, badge, className }: CaseVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setStarted(false);
    setFailed(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, [src]);

  const play = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setStarted(true);
    void video.play();
  };

  return (
    <div className={cn("bg-muted relative aspect-video overflow-hidden rounded-2xl", className)}>
      {failed ? (
        poster ? (
          <img src={poster} alt="" className="size-full object-cover" />
        ) : null
      ) : (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          aria-label={started ? label : undefined}
          className="size-full object-cover"
          controls={started}
          playsInline
          preload="none"
          onError={() => setFailed(true)}
        />
      )}
      {badge ? (
        <span className="bg-background/85 pointer-events-none absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium backdrop-blur">
          {badge}
        </span>
      ) : null}
      {started || failed ? null : (
        <button
          type="button"
          onClick={play}
          aria-label={label}
          className="group absolute inset-0 cursor-pointer"
        >
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md transition-transform group-hover:scale-110">
              <Play className="size-6 translate-x-0.5 fill-current" aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * A template's look at a glance: its preview clip as a muted loop when there is one, else its
 * poster. `playing` lets cards start the loop on hover only.
 */
export function TemplateMedia({
  templateId,
  playing = true,
  alt = "",
  className,
}: {
  templateId: VideoTemplateId;
  playing?: boolean;
  alt?: string;
  className?: string;
}) {
  const poster = templatePoster(templateId);
  const video = templatePreviewVideo(templateId);
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div className={cn("bg-muted relative overflow-hidden", className)}>
      <img src={poster} alt={alt} loading="lazy" className="size-full object-cover" />
      {video && playing && !videoFailed ? (
        <video
          src={video}
          poster={poster}
          aria-hidden="true"
          muted
          loop
          autoPlay
          playsInline
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  );
}
