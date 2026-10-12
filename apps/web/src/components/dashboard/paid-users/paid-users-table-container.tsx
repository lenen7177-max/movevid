"use no memo";

import { useNavigate, useSearch } from "@tanstack/react-router";
import type { SortingState } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { parseSortString, serializeSortString } from "@/lib/parsers";
import type { ExtendedColumnSort } from "@/types/data-table";
import { AcquisitionSummary } from "./acquisition-summary";
import { PaidUsersTable } from "./paid-users-table";
import type { PaidMembershipTier, PaidUser, PaidUserProvider, PaidUserState } from "./types";
import { usePaidUsers } from "./use-paid-users";

const sortableColumnSet = new Set<string>(["name", "latestBillingAt"]);

/** Keeps every server-side table control in the URL so filtered admin views are shareable. */
export function PaidUsersTableContainer() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_authed/(dashboard)/admin/paid-users" });
  const defaultSorting = useMemo<ExtendedColumnSort<PaidUser>[]>(
    () => [{ id: "latestBillingAt", desc: true }],
    [],
  );
  const page = searchParams.page ?? 0;
  const size = searchParams.size ?? 10;
  const search = searchParams.search ?? "";
  const states = (searchParams.state ?? []) as PaidUserState[];
  const tiers = (searchParams.tier ?? []) as PaidMembershipTier[];
  const providers = (searchParams.provider ?? []) as PaidUserProvider[];
  const sorting = useMemo(() => {
    const parsed = parseSortString<PaidUser>(
      searchParams.sort ?? "latestBillingAt:desc",
      sortableColumnSet,
    );
    return parsed ?? defaultSorting;
  }, [defaultSorting, searchParams.sort]);

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

  const normalizeSorting = useCallback(
    (value: SortingState): ExtendedColumnSort<PaidUser>[] => {
      const filtered = value
        .filter((item) => sortableColumnSet.has(item.id))
        .slice(0, 1) as ExtendedColumnSort<PaidUser>[];
      return filtered.length > 0 ? filtered : defaultSorting;
    },
    [defaultSorting],
  );

  const { data, isFetching, isLoading, refetch } = usePaidUsers({
    pageIndex: page,
    pageSize: size,
    search,
    sorting,
    states,
    tiers,
    providers,
  });

  return (
    <div className="space-y-6">
      <AcquisitionSummary />
      <PaidUsersTable
        data={data?.data ?? []}
        total={data?.total ?? 0}
        counts={data?.counts ?? { paid: 0, trial: 0, ended: 0 }}
        pageIndex={page}
        pageSize={size}
        search={search}
        sorting={sorting}
        states={states}
        tiers={tiers}
        providers={providers}
        loading={isLoading}
        refreshing={isFetching}
        onSearch={(value) => setSearchParams({ search: value, page: 0 })}
        onFiltersChange={({ states: nextStates, tiers: nextTiers, providers: nextProviders }) =>
          setSearchParams({
            state: nextStates,
            tier: nextTiers,
            provider: nextProviders,
            page: 0,
          })
        }
        onPageChange={(value) => setSearchParams({ page: value })}
        onPageSizeChange={(value) => setSearchParams({ size: value, page: 0 })}
        onRefresh={() => refetch()}
        onSortingChange={(value) => {
          const nextSorting = normalizeSorting(value);
          setSearchParams({ sort: serializeSortString(nextSorting), page: 0 });
        }}
      />
    </div>
  );
}
