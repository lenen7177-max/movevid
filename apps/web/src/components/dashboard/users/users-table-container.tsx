"use no memo";

import type { AppRole } from "@repo/app-config/rbac";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { SortingState } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

import { parseSortString, serializeSortString } from "@/lib/parsers";
import type { ExtendedColumnSort } from "@/types/data-table";
import type { User } from "./types";
import { useUsers } from "./use-users";
import { UsersTable } from "./users-table";

const sortableColumnIds = ["name", "createdAt"] as const;
const sortableColumnSet = new Set<string>(sortableColumnIds);

export function UsersTableContainer() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_authed/(dashboard)/users" });

  const defaultSorting = useMemo<ExtendedColumnSort<User>[]>(
    () => [{ id: "createdAt", desc: true }],
    [],
  );

  // Get values from search params with defaults
  const page = searchParams.page ?? 0;
  const size = searchParams.size ?? 10;
  const search = searchParams.search ?? "";
  const sortString = searchParams.sort ?? "createdAt:desc";
  const roles = (searchParams.role ?? []) as AppRole[];

  // Parse sort string to sorting state
  const sort = useMemo(() => {
    const parsed = parseSortString<User>(sortString, sortableColumnSet);
    return parsed ?? defaultSorting;
  }, [sortString, defaultSorting]);

  // Update search params helper
  const setSearchParams = useCallback(
    (updates: Partial<typeof searchParams>) => {
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );

  // Normalize sorting to ensure it only contains valid column ids
  const safeSorting = useMemo(() => {
    const filtered = sort
      .filter((item) => sortableColumnSet.has(item.id as string))
      .map((item) => ({
        ...item,
        id: item.id as Extract<keyof User, string>,
      })) as ExtendedColumnSort<User>[];

    return filtered.length > 0 ? filtered : defaultSorting;
  }, [sort, defaultSorting]);

  // Normalize function for callbacks
  const normalizeSorting = useCallback(
    (value: SortingState): ExtendedColumnSort<User>[] => {
      const filtered = value
        .filter((item) => sortableColumnSet.has(item.id as string))
        .map((item) => ({
          ...item,
          id: item.id as Extract<keyof User, string>,
        })) as ExtendedColumnSort<User>[];

      return filtered.length > 0 ? filtered : defaultSorting;
    },
    [defaultSorting],
  );

  const { data, isFetching, isLoading, refetch } = useUsers({
    pageIndex: page,
    pageSize: size,
    search,
    sorting: safeSorting,
    roles,
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <UsersTable
      data={users}
      total={total}
      pageIndex={page}
      pageSize={size}
      search={search}
      roles={roles}
      sorting={safeSorting}
      loading={isLoading}
      refreshing={isFetching}
      onSearch={(newSearch) => setSearchParams({ search: newSearch, page: 0 })}
      onRolesChange={(nextRoles) => setSearchParams({ role: nextRoles, page: 0 })}
      onPageChange={(newPageIndex) => setSearchParams({ page: newPageIndex })}
      onPageSizeChange={(newPageSize) => setSearchParams({ size: newPageSize, page: 0 })}
      onRefresh={async () => {
        await refetch();
      }}
      onSortingChange={(newSorting) => {
        const nextSorting = normalizeSorting(newSorting);
        setSearchParams({ sort: serializeSortString(nextSorting), page: 0 });
      }}
    />
  );
}
