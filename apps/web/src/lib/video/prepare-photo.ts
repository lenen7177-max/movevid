/**
 * Validates a photo against Seedance's reference image limits and shrinks
 * oversized ones before upload.
 */

export type PhotoErrorCode = "fileType" | "fileSize" | "tooSmall" | "aspect" | "unreadable";

export class PhotoError extends Error {
  constructor(readonly code: PhotoErrorCode) {
    super(code);
  }
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 20 * 1024 * 1024;
const MIN_SIDE = 300;
const MIN_ASPECT = 0.4;
const MAX_ASPECT = 2.5;
const MAX_LONG_SIDE = 2048;
const JPEG_QUALITY = 0.92;

export async function preparePhoto(file: File): Promise<File> {
  if (!ALLOWED_TYPES.has(file.type)) throw new PhotoError("fileType");
  if (file.size > MAX_BYTES) throw new PhotoError("fileSize");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError("unreadable");
  }

  try {
    const { width, height } = bitmap;
    if (Math.min(width, height) < MIN_SIDE) throw new PhotoError("tooSmall");
    const aspect = width / height;
    if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) throw new PhotoError("aspect");

    const longSide = Math.max(width, height);
    if (longSide <= MAX_LONG_SIDE) return file;

    const scale = MAX_LONG_SIDE / longSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
