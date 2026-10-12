import type { client } from "@/utils/orpc";

export type PaidUsersResponse = Awaited<ReturnType<typeof client.admin.billing.listPaidUsers>>;
export type PaidUser = PaidUsersResponse["data"][number];
export type PaidUserState = PaidUser["state"];
export type PaidMembershipTier = NonNullable<PaidUser["membershipTier"]>;
export type PaidUserProvider = PaidUser["provider"];
