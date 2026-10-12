/**
 * Landing → studio photo handoff.
 *
 * The landing page saves the picked photos in IndexedDB before navigating to the
 * studio, so they survive the sign-in round trip (including OAuth redirects).
 */

import { VIDEO_PHOTO_SLOTS, type VideoPhotoSlot } from "@repo/app-config/video";

export type VideoSide = VideoPhotoSlot;
export type VideoPhotos = Partial<Record<VideoSide, File>>;

const DB_NAME = "video-studio";
const STORE = "handoff";
const RECORD_KEY = "pending";

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
      VIDEO_PHOTO_SLOTS.map((slot) => [slot, photos[slot] ?? null]),
    );
    await withStore("readwrite", (store) => store.put(record, RECORD_KEY));
  } catch {
    // Private mode or blocked storage: the studio simply opens empty.
  }
}

export async function loadHandoffPhotos(): Promise<VideoPhotos> {
  try {
    const record = await withStore<Partial<Record<VideoSide, File | null>> | undefined>(
      "readonly",
      (store) => store.get(RECORD_KEY),
    );
    return Object.fromEntries(
      VIDEO_PHOTO_SLOTS.flatMap((slot) => (record?.[slot] ? [[slot, record[slot]]] : [])),
    ) as VideoPhotos;
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
