import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";
import type { AdminOperationAction, AdminOperationStatus } from "./types";

interface UseAdminOperationsParams {
  pageIndex: number;
  pageSize: number;
  search: string;
  actions: AdminOperationAction[];
  statuses: AdminOperationStatus[];
}

export function useAdminOperations(params: UseAdminOperationsParams) {
  return useQuery({
    queryKey: [...orpc.admin.operations.list.key(), params],
    queryFn: () =>
      client.admin.operations.list({
        page: params.pageIndex + 1,
        perPage: params.pageSize,
        search: params.search || undefined,
        actions: params.actions,
        statuses: params.statuses,
      }),
    placeholderData: keepPreviousData,
  });
}
