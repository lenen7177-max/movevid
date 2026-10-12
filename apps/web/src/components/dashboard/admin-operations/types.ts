import type { client } from "@/utils/orpc";

export type AdminOperationsResponse = Awaited<ReturnType<typeof client.admin.operations.list>>;
export type AdminOperation = AdminOperationsResponse["data"][number];
export type AdminOperationAction = AdminOperation["action"];
export type AdminOperationStatus = AdminOperation["status"];
