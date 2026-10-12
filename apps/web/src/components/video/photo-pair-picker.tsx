import { ImagePlus, PawPrint, UserRound, X } from "lucide-react";
import { Fragment, useEffect, useId, useState } from "react";
import { useTranslations } from "@/i18n";
import type { VideoSide } from "@/lib/video/photo-handoff";
import { cn } from "@/lib/utils";
import type { PhotoPair } from "./use-photo-pair";

const ACCEPT = "image/jpeg,image/png,image/webp";

type PhotoSlotProps = {
  side: VideoSide;
  /** 1-based position, matching "Photo N" in prompts and error messages. */
  number: number;
  role: string;
  preview?: string;
  /** The slot takes a pet photo as well as a person's. */
  allowsPets?: boolean;
  disabled?: boolean;
  onSelect: (side: VideoSide, file: File | undefined) => void;
};

function PhotoSlot({
  side,
  number,
  role,
  preview,
  allowsPets,
  disabled,
  onSelect,
}: PhotoSlotProps) {
  const t = useTranslations("video.slots");
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const label = t("photoNumber", { n: number });
  const showPreview = Boolean(preview) && !previewFailed;

  useEffect(() => {
    setPreviewFailed(false);
  }, [preview]);

  return (
    <div className="relative flex-1">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) onSelect(side, event.dataTransfer.files[0]);
        }}
        className={cn(
          "group bg-muted/40 hover:border-primary/60 hover:bg-primary/5 relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-foreground/15 text-center transition-colors",
          dragging && "border-primary bg-primary/15",
          showPreview && "border-solid border-transparent",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {showPreview ? (
          <img
            src={preview}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => setPreviewFailed(true)}
          />
        ) : allowsPets ? (
          <>
            <span className="text-primary flex items-center gap-1.5" aria-hidden="true">
              <UserRound className="size-6" />
              <span className="text-primary/50 text-sm">/</span>
              <PawPrint className="size-6" />
            </span>
            <span className="text-sm font-medium">{t("upload")}</span>
            <span className="text-muted-foreground text-xs">{t("personOrPet")}</span>
          </>
        ) : (
          <>
            <ImagePlus className="size-7 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">{t("upload")}</span>
          </>
        )}
        <span
          className={cn(
            "absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2.5 py-1 text-[11px] font-medium",
            showPreview
              ? "bg-black/60 text-white"
              : "bg-background text-foreground ring-border ring-1",
          )}
        >
          {number} · {role}
        </span>
        {showPreview ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {t("replace")}
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        aria-label={allowsPets ? `${label} · ${role} · ${t("personOrPet")}` : `${label} · ${role}`}
        onChange={(event) => {
          onSelect(side, event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {showPreview && !disabled ? (
        <button
          type="button"
          onClick={() => onSelect(side, undefined)}
          aria-label={`${t("remove")} · ${label}`}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

type PhotoPairPickerProps = {
  pair: PhotoPair;
  /** The template's photo slots, in order (photo 1, photo 2, …). */
  slots: readonly VideoSide[];
  /** Who each slot plays in the template. */
  roles: Partial<Record<VideoSide, string>>;
  /** Fewest photos the template accepts; below slots.length the rest are optional. */
  minPhotos?: number;
  /** The template also animates pets, so say so next to the uploads. */
  allowsPets?: boolean;
  disabled?: boolean;
  className?: string;
};

/** One upload slot per template role; the template decides who each photo plays. */
export function PhotoPairPicker({
  pair,
  slots,
  roles,
  minPhotos = slots.length,
  allowsPets = false,
  disabled,
  className,
}: PhotoPairPickerProps) {
  const t = useTranslations("video.slots");
  const onSelect = (side: VideoSide, file: File | undefined) => {
    void pair.setPhoto(side, file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex items-center",
          slots.length > 2 ? "gap-2" : "gap-3",
          // A lone slot would otherwise stretch to a very tall 3:4 card.
          slots.length === 1 && "mx-auto max-w-56",
        )}
      >
        {slots.map((slot, index) => (
          <Fragment key={slot}>
            {index > 0 ? (
              <span className="text-muted-foreground text-xl font-light" aria-hidden="true">
                ×
              </span>
            ) : null}
            <PhotoSlot
              side={slot}
              number={index + 1}
              role={roles[slot] ?? ""}
              preview={pair.previews[slot]}
              allowsPets={allowsPets}
              disabled={disabled}
              onSelect={onSelect}
            />
          </Fragment>
        ))}
      </div>
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span>{t("hint")}</span>
        <span className="shrink-0 tabular-nums">
          {t("count", {
            count: slots.filter((slot) => pair.photos[slot]).length,
            total: slots.length,
          })}
        </span>
      </div>
      {minPhotos < slots.length ? (
        <p className="text-primary text-xs font-medium">
          {t("optional", { min: minPhotos, total: slots.length })}
        </p>
      ) : null}
      {allowsPets ? (
        <p className="text-primary flex items-start gap-1.5 text-xs font-medium">
          <PawPrint className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {t("petsHint")}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">{t("photoRule")}</p>
    </div>
  );
}
