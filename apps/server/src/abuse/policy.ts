import {
  emailDomainCandidates,
  getClientIp,
  hashNamespacedValue,
  isPhoneCompatibilityEmail,
  normalizeDeviceId,
  CLIENT_DEVICE_ID_HEADER,
} from "@repo/shared";
import { and, eq, inArray, or } from "drizzle-orm";
import type { Database } from "@/db";
import { abuseBlocklist, type AbuseBlocklistKind } from "@/db/schema/abuse";
import { isDisposableEmailDomain } from "./disposable-email-domains";

type AbuseBlockQuery = {
  email?: string | null;
  ipAddress?: string | null;
  deviceId?: string | null;
  hashSecret?: string | null;
  includeDisposableEmailDomains: boolean;
  kinds: readonly AbuseBlockKind[];
};

type AbuseBlockKind = AbuseBlocklistKind;

const BLOCK_PRIORITY: AbuseBlockKind[] = ["email_domain", "ip", "device"];

function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || trimmed.length > 128 || /\s/.test(trimmed)) return null;
  return trimmed;
}

export function abuseBlockErrorKey(kind: AbuseBlockKind): string {
  if (kind === "email_domain") return "errors.emailDomainBlocked";
  if (kind === "device") return "errors.deviceBlocked";
  return "errors.networkBlocked";
}

export async function findAbuseBlock(
  db: Database,
  input: AbuseBlockQuery,
): Promise<AbuseBlockKind | null> {
  const kinds = new Set(input.kinds);
  const email = input.email && !isPhoneCompatibilityEmail(input.email) ? input.email : null;
  const domains = kinds.has("email_domain") && email ? emailDomainCandidates(email) : [];
  if (
    input.includeDisposableEmailDomains &&
    kinds.has("email_domain") &&
    email &&
    isDisposableEmailDomain(email)
  ) {
    return "email_domain";
  }

  const ipAddress = kinds.has("ip") ? normalizeIp(input.ipAddress) : null;
  const deviceId = kinds.has("device") ? normalizeDeviceId(input.deviceId) : null;
  const deviceHash = deviceId
    ? await hashNamespacedValue(deviceId, "device", input.hashSecret)
    : null;

  const predicates = [];
  if (domains.length > 0) {
    predicates.push(
      and(eq(abuseBlocklist.kind, "email_domain"), inArray(abuseBlocklist.value, domains)),
    );
  }
  if (ipAddress) {
    predicates.push(and(eq(abuseBlocklist.kind, "ip"), eq(abuseBlocklist.value, ipAddress)));
  }
  if (deviceHash) {
    predicates.push(and(eq(abuseBlocklist.kind, "device"), eq(abuseBlocklist.value, deviceHash)));
  }
  if (predicates.length === 0) return null;
  const onlyPredicate = predicates[0];
  const whereClause = predicates.length === 1 && onlyPredicate ? onlyPredicate : or(...predicates);

  const hits = await db
    .select({ kind: abuseBlocklist.kind })
    .from(abuseBlocklist)
    .where(whereClause);
  const matched = new Set(hits.map((hit) => hit.kind));
  return BLOCK_PRIORITY.find((kind) => matched.has(kind)) ?? null;
}

export async function findRequestAbuseBlock(
  db: Database,
  input: {
    headers: Headers;
    email?: string | null;
    hashSecret?: string | null;
    includeDisposableEmailDomains: boolean;
    kinds: readonly AbuseBlockKind[];
  },
): Promise<AbuseBlockKind | null> {
  return findAbuseBlock(db, {
    email: input.email,
    ipAddress: getClientIp(input.headers),
    deviceId: input.headers.get(CLIENT_DEVICE_ID_HEADER),
    hashSecret: input.hashSecret,
    includeDisposableEmailDomains: input.includeDisposableEmailDomains,
    kinds: input.kinds,
  });
}
