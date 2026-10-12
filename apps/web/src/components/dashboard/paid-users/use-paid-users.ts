import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { client } from "@/utils/orpc";
import type { PaidMembershipTier, PaidUserProvider, PaidUserState } from "./types";

export const paidUsersKeys = {
  all: ["admin", "billing", "paid-users"] as const,
  list: (params: UsePaidUsersParams) => [...paidUsersKeys.all, params] as const,
};

interface UsePaidUsersParams {
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: SortingState;
  states: PaidUserState[];
  tiers: PaidMembershipTier[];
  providers: PaidUserProvider[];
}

/** Fetches the server-resolved page while retaining the previous page during navigation changes. */
export function usePaidUsers(params: UsePaidUsersParams) {
  return useQuery({
    queryKey: paidUsersKeys.list(params),
    queryFn: () =>
      client.admin.billing.listPaidUsers({
        page: params.pageIndex + 1,
        perPage: params.pageSize,
        search: params.search || undefined,
        states: params.states,
        tiers: params.tiers,
        providers: params.providers,
        sort: params.sorting
          .filter((item): item is typeof item & { id: "name" | "latestBillingAt" } =>
            ["name", "latestBillingAt"].includes(item.id),
          )
          .slice(0, 1)
          .map((item) => ({ id: item.id, desc: item.desc })),
      }),
    placeholderData: keepPreviousData,
  });
}
