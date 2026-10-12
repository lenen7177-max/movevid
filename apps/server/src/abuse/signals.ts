import { hashNamespacedValue, normalizeDeviceId } from "@repo/shared";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { userClientSignal, type ClientSignalPlatform } from "@/db/schema/abuse";

const SIGNAL_WRITE_INTERVAL_MS = 60 * 60 * 1000;
const recentSignalWrites = new Map<string, number>();

export async function recordClientSignal(
  db: Database,
  input: {
    userId: string;
    platform: ClientSignalPlatform;
    deviceId: string | null;
    ipAddress: string | null;
    hashSecret?: string | null;
  },
): Promise<void> {
  const deviceId = normalizeDeviceId(input.deviceId);
  if (!deviceId) return;

  const deviceHash = await hashNamespacedValue(deviceId, "device", input.hashSecret);
  const ipHash = await hashNamespacedValue(input.ipAddress, "ip", input.hashSecret);
  if (!deviceHash) return;

  const nowMs = Date.now();
  const cacheKey = `${input.userId}:${deviceHash}:${ipHash ?? ""}`;
  const lastWrite = recentSignalWrites.get(cacheKey);
  if (lastWrite != null && nowMs - lastWrite < SIGNAL_WRITE_INTERVAL_MS) return;

  const now = new Date(nowMs);
  await db
    .insert(userClientSignal)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      platform: input.platform,
      deviceHash,
      ipHash,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userClientSignal.userId, userClientSignal.deviceHash],
      set: {
        platform: input.platform,
        ipHash,
        lastSeenAt: now,
        updatedAt: now,
      },
    });

  if (recentSignalWrites.size > 5000) recentSignalWrites.clear();
  recentSignalWrites.set(cacheKey, nowMs);
}

export async function findLatestDeviceHash(db: Database, userId: string): Promise<string | null> {
  const [signal] = await db
    .select({ deviceHash: userClientSignal.deviceHash })
    .from(userClientSignal)
    .where(eq(userClientSignal.userId, userId))
    .orderBy(desc(userClientSignal.lastSeenAt))
    .limit(1);

  return signal?.deviceHash ?? null;
}
