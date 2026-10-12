"use no memo";

import type { AppRole } from "@repo/app-config/rbac";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { client } from "@/utils/orpc";

// Query keys for cache management
export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "lists"] as const,
  list: (params: {
    pageIndex: number;
    pageSize: number;
    search: string;
    sorting: SortingState;
    roles: AppRole[];
  }) => [...usersKeys.lists(), params] as const,
};

interface UseUsersParams {
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: SortingState;
  roles?: AppRole[];
}

/**
 * Hook to fetch users with pagination, search, sorting, and role filters.
 * Uses keepPreviousData to avoid flickering when changing pages.
 */
export function useUsers({ pageIndex, pageSize, search, sorting, roles = [] }: UseUsersParams) {
  return useQuery({
    queryKey: usersKeys.list({
      pageIndex,
      pageSize,
      search,
      sorting,
      roles,
    }),
    queryFn: async () => {
      const result = await client.users.list({
        page: pageIndex + 1,
        perPage: pageSize,
        name: search || undefined,
        role: roles.length > 0 ? roles : undefined,
        sort: sorting
          .filter((s): s is typeof s & { id: "name" | "createdAt" } =>
            ["name", "createdAt"].includes(s.id),
          )
          .map((s) => ({ id: s.id, desc: s.desc })),
      });

      return {
        items: result.data ?? [],
        total: result.total ?? 0,
        pageCount: result.pageCount ?? 0,
      };
    },
    placeholderData: keepPreviousData,
  });
}
