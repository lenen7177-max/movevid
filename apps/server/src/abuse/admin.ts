import { emailDomainCandidates, isPhoneCompatibilityEmail } from "@repo/shared";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "@/db";
import { abuseBlocklist, type AbuseBlocklistKind } from "@/db/schema/abuse";
import { session } from "@/db/schema/auth";
import { creditSignupGrantClaim } from "@/db/schema/credits";
import { findLatestDeviceHash } from "./signals";

export class AbuseBlockError extends Error {
  constructor(readonly code: "phone_domain" | "missing_ip" | "missing_device" | "invalid_domain") {
    super(code);
  }
}

export type SignupGrantSnapshot = {
  status: "granted" | "blocked";
  reason: string;
};

function normalizeBlockValue(kind: AbuseBlocklistKind, value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (kind === "device") return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
  if (kind === "ip") return trimmed.length <= 128 && !/\s/.test(trimmed) ? trimmed : null;
  return emailDomainCandidates(`user@${trimmed}`)[0] === trimmed ? trimmed : null;
}

async function insertBlock(
  db: Database,
  input: { kind: AbuseBlocklistKind; value: string; createdBy: string },
) {
  const [existing] = await db
    .select({ id: abuseBlocklist.id })
    .from(abuseBlocklist)
    .where(and(eq(abuseBlocklist.kind, input.kind), eq(abuseBlocklist.value, input.value)))
    .limit(1);
  if (existing) return;

  const now = new Date();
  await db.insert(abuseBlocklist).values({
    id: crypto.randomUUID(),
    kind: input.kind,
    value: input.value,
    reason: "admin",
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

export async function blockManagedUserIdentifier(
  db: Database,
  input: {
    userId: string;
    email: string;
    kind: AbuseBlocklistKind;
    createdBy: string;
  },
): Promise<{ kind: AbuseBlocklistKind; value: string }> {
  if (input.kind === "email_domain") {
    if (isPhoneCompatibilityEmail(input.email)) {
      throw new AbuseBlockError("phone_domain");
    }
    const domain = emailDomainCandidates(input.email)[0] ?? null;
    const value = domain ? normalizeBlockValue("email_domain", domain) : null;
    if (!value) throw new AbuseBlockError("invalid_domain");
    await insertBlock(db, { kind: "email_domain", value, createdBy: input.createdBy });
    return { kind: "email_domain", value };
  }

  if (input.kind === "ip") {
    const [latestSession] = await db
      .select({ ipAddress: session.ipAddress })
      .from(session)
      .where(and(eq(session.userId, input.userId), isNotNull(session.ipAddress)))
      .orderBy(desc(session.updatedAt))
      .limit(1);
    const value = normalizeBlockValue("ip", latestSession?.ipAddress ?? "");
    if (!value) throw new AbuseBlockError("missing_ip");
    await insertBlock(db, { kind: "ip", value, createdBy: input.createdBy });
    return { kind: "ip", value };
  }

  const deviceHash = await findLatestDeviceHash(db, input.userId);
  const value = deviceHash ? normalizeBlockValue("device", deviceHash) : null;
  if (!value) throw new AbuseBlockError("missing_device");
  await insertBlock(db, { kind: "device", value, createdBy: input.createdBy });
  return { kind: "device", value };
}

export async function listLatestSignupGrantClaims(
  db: Database,
  userIds: string[],
): Promise<Map<string, SignupGrantSnapshot>> {
  const claims = new Map<string, SignupGrantSnapshot>();
  if (userIds.length === 0) return claims;

  const rows = await db
    .select({
      userId: creditSignupGrantClaim.userId,
      status: creditSignupGrantClaim.status,
      reason: creditSignupGrantClaim.reason,
      createdAt: creditSignupGrantClaim.createdAt,
    })
    .from(creditSignupGrantClaim)
    .where(inArray(creditSignupGrantClaim.userId, userIds))
    .orderBy(desc(creditSignupGrantClaim.createdAt));

  for (const row of rows) {
    if (claims.has(row.userId)) continue;
    claims.set(row.userId, { status: row.status, reason: row.reason });
  }
  return claims;
}
