import { VIDEO_PHOTO_SLOTS, type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import type { VideoPhotos, VideoSide } from "@/lib/video/photo-handoff";
import { PhotoError, preparePhoto } from "@/lib/video/prepare-photo";
import { samplePhotoUrl } from "@/lib/video/templates";

export type PhotoPair = {
  photos: VideoPhotos;
  previews: Partial<Record<VideoSide, string>>;
  count: number;
  /** True while the photos are the bundled sample set. */
  isSample: boolean;
  setPhoto: (side: VideoSide, file: File | undefined) => Promise<void>;
  setPhotos: (photos: VideoPhotos) => void;
  setSamplePhotos: (photos: VideoPhotos) => void;
};

/** Holds the picked photos (one per template slot) with validated files and preview URLs. */
export function usePhotoPair(): PhotoPair {
  const t = useTranslations("video.errors");
  const [photos, setPhotosState] = useState<VideoPhotos>({});
  const [previews, setPreviews] = useState<Partial<Record<VideoSide, string>>>({});
  const [isSample, setIsSample] = useState(false);

  useEffect(() => {
    const next: Partial<Record<VideoSide, string>> = {};
    for (const slot of VIDEO_PHOTO_SLOTS) {
      const file = photos[slot];
      if (file) next[slot] = URL.createObjectURL(file);
    }
    setPreviews(next);
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [photos]);

  const setPhoto = async (side: VideoSide, file: File | undefined) => {
    setIsSample(false);
    if (!file) {
      setPhotosState((current) => ({ ...current, [side]: undefined }));
      return;
    }
    try {
      const prepared = await preparePhoto(file);
      setPhotosState((current) => ({ ...current, [side]: prepared }));
    } catch (error) {
      toast.error(error instanceof PhotoError ? t(error.code) : t("unreadable"));
    }
  };

  return {
    photos,
    previews,
    count: VIDEO_PHOTO_SLOTS.filter((slot) => photos[slot]).length,
    isSample,
    setPhoto,
    setPhotos: (next: VideoPhotos) => {
      setIsSample(false);
      setPhotosState(next);
    },
    setSamplePhotos: (next: VideoPhotos) => {
      setIsSample(true);
      setPhotosState(next);
    },
  };
}

/** Loads the template's bundled sample photos, one per slot. */
export async function fetchSamplePhotos(templateId: VideoTemplateId): Promise<VideoPhotos> {
  const slots = videoTemplates[templateId].slots;
  const load = async (side: VideoSide) => {
    const url = samplePhotoUrl(templateId, side);
    if (!url) throw new Error("sample_missing");
    const resp = await fetch(url);
    const type = resp.headers.get("content-type") ?? "";
    if (!resp.ok || !type.startsWith("image/")) throw new Error("sample_missing");
    return new File([await resp.blob()], `sample-${side}.jpg`, { type });
  };
  const files = await Promise.all(slots.map(load));
  return Object.fromEntries(slots.map((slot, index) => [slot, files[index]])) as VideoPhotos;
}
