/**
 * Landing → studio photo handoff.
 *
 * The landing page saves the picked photos in IndexedDB before navigating to the
 * studio, so they survive the sign-in round trip (including OAuth redirects).
 *
 * Photos are stored as raw bytes, not File objects: iOS Safari can hand back a stored picker
 * File as an empty or unreadable file after a checkout redirect, which the studio only
 * surfaces as a generic error after the user has paid.
 */

import { VIDEO_PHOTO_SLOTS, type VideoPhotoSlot } from "@repo/app-config/video";

export type VideoSide = VideoPhotoSlot;
export type VideoPhotos = Partial<Record<VideoSide, File>>;

const DB_NAME = "video-studio";
const STORE = "handoff";
const RECORD_KEY = "pending";

type StoredPhoto = { bytes: ArrayBuffer; type: string; name: string };

async function toStored(file: File): Promise<StoredPhoto> {
  return { bytes: await file.arrayBuffer(), type: file.type, name: file.name };
}

/** Rebuilds an in-memory File; records saved before the byte format may still hold Files. */
async function fromStored(value: StoredPhoto | Blob): Promise<File> {
  if (value instanceof Blob) {
    const name = value instanceof File ? value.name : "photo";
    return new File([await value.arrayBuffer()], name, { type: value.type });
  }
  return new File([value.bytes], value.name, { type: value.type });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_open_failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("indexeddb_request_failed"));
    });
  } finally {
    db.close();
  }
}

/** Saves the current photos. Failures are swallowed: the handoff is a convenience. */
export async function saveHandoffPhotos(photos: VideoPhotos): Promise<void> {
  try {
    const record = Object.fromEntries(
      await Promise.all(
        VIDEO_PHOTO_SLOTS.map(async (slot) => {
          const file = photos[slot];
          return [slot, file ? await toStored(file) : null] as const;
        }),
      ),
    );
    await withStore("readwrite", (store) => store.put(record, RECORD_KEY));
  } catch {
    // Private mode or blocked storage: the studio simply opens empty.
  }
}

export async function loadHandoffPhotos(): Promise<VideoPhotos> {
  try {
    const record = await withStore<
      Partial<Record<VideoSide, StoredPhoto | Blob | null>> | undefined
    >("readonly", (store) => store.get(RECORD_KEY));
    const entries = await Promise.all(
      VIDEO_PHOTO_SLOTS.map(async (slot) => {
        const value = record?.[slot];
        if (!value) return null;
        // An unreadable or empty photo leaves its slot for a fresh pick rather than failing the
        // upload later; Safari can hand back a stored File as an empty one.
        const file = await fromStored(value).catch(() => null);
        return file && file.size > 0 ? ([slot, file] as const) : null;
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null)) as VideoPhotos;
  } catch {
    return {};
  }
}

export async function clearHandoffPhotos(): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(RECORD_KEY));
  } catch {
    // Nothing to clear.
  }
}
