import { type VideoModel, type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import { useEffect, useState } from "react";
import { muxSoundtrack } from "@/lib/video/mux-soundtrack";

type SoundtrackedVideo =
  | { status: "mixing" }
  | { status: "ready"; src: string; downloadHref: string; withSoundtrack: boolean };

/** Returns a playable/downloadable URL with the template's soundtrack added, falling back to the silent render. */
export function useSoundtrackedVideo(
  videoUrl: string | null,
  templateId: VideoTemplateId,
  model: VideoModel,
): SoundtrackedVideo | null {
  const [state, setState] = useState<SoundtrackedVideo | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setState(null);
      return;
    }

    // Silent templates: play and download the render as-is.
    if (!videoTemplates[templateId].soundtrack) {
      setState({
        status: "ready",
        src: videoUrl,
        downloadHref: `${videoUrl}?download=1`,
        withSoundtrack: false,
      });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "mixing" });

    muxSoundtrack(videoUrl, templateId, model)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({
          status: "ready",
          src: objectUrl,
          downloadHref: objectUrl,
          withSoundtrack: true,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[video] soundtrack mux failed", error);
        setState({
          status: "ready",
          src: videoUrl,
          downloadHref: `${videoUrl}?download=1`,
          withSoundtrack: false,
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [videoUrl, templateId, model]);

  return state;
}
