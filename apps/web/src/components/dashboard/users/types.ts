import type { client } from "@/utils/orpc";

// Infer User type from oRPC client response
type UsersListResponse = Awaited<ReturnType<typeof client.users.list>>;
export type User = UsersListResponse["data"][number];
