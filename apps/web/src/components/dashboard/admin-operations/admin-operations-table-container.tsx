"use no memo";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { AdminOperationsTable } from "./admin-operations-table";
import type { AdminOperationAction, AdminOperationStatus } from "./types";
import { useAdminOperations } from "./use-admin-operations";

export function AdminOperationsTableContainer() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_authed/(dashboard)/admin/operations" });
  const page = searchParams.page ?? 0;
  const size = searchParams.size ?? 20;
  const search = searchParams.search ?? "";
  const actions = (searchParams.action ?? []) as AdminOperationAction[];
  const statuses = (searchParams.status ?? []) as AdminOperationStatus[];
  const setSearchParams = useCallback(
    (updates: Partial<typeof searchParams>) => {
      navigate({
        to: ".",
        search: (previous) => ({ ...previous, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );
  const { data, isFetching, isLoading, refetch } = useAdminOperations({
    pageIndex: page,
    pageSize: size,
    search,
    actions,
    statuses,
  });

  return (
    <AdminOperationsTable
      data={data?.data ?? []}
      total={data?.total ?? 0}
      pageIndex={page}
      pageSize={size}
      search={search}
      actions={actions}
      statuses={statuses}
      loading={isLoading}
      refreshing={isFetching}
      onSearch={(value) => setSearchParams({ search: value, page: 0 })}
      onFiltersChange={({ actions: nextActions, statuses: nextStatuses }) =>
        setSearchParams({ action: nextActions, status: nextStatuses, page: 0 })
      }
      onPageChange={(value) => setSearchParams({ page: value })}
      onPageSizeChange={(value) => setSearchParams({ size: value, page: 0 })}
      onRefresh={() => refetch()}
    />
  );
}
