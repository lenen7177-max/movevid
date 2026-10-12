import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** Loads web-available credit packages. */
export function useCreditPackagesQuery() {
  return useQuery({
    queryKey: ["credits", "packages", "web"],
    queryFn: () => orpc.credits.listPackages.call({ platform: "web" }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Loads the current authenticated account credit balance. */
export function useCreditBalanceQuery() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => orpc.credits.getBalance.call({}),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Loads recent web credit package purchase orders. */
export function useCreditOrdersQuery(enabled = true) {
  return useQuery({
    queryKey: ["credits", "orders", "web"],
    queryFn: () => orpc.credits.listOrders.call({ page: 1, perPage: 10 }),
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: enabled,
  });
}

/** Loads recent credit ledger transactions. */
export function useCreditTransactionsQuery(
  page = 1,
  perPage = 10,
  sourceType?: "purchase" | "usage",
) {
  return useQuery({
    queryKey: ["credits", "transactions", page, perPage, sourceType ?? null],
    queryFn: () => orpc.credits.listTransactions.call({ page, perPage, sourceType }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
