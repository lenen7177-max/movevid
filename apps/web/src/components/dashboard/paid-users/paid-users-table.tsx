"use no memo";

import { SUPPORTED_SERVER_PAYMENT_PROVIDERS } from "@repo/app-config";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { debounce } from "lodash-es";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSign,
  Clock3,
  History,
  Loader2Icon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { DataTablePageInput } from "@/components/data-table/data-table-pagination";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Option } from "@/types/data-table";
import { usePaidUserColumns } from "./paid-users-columns";
import { TableRowSkeleton } from "./table-row-skeleton";
import type {
  PaidMembershipTier,
  PaidUser,
  PaidUserProvider,
  PaidUserState,
  PaidUsersResponse,
} from "./types";

const paidUserProviders = [...SUPPORTED_SERVER_PAYMENT_PROVIDERS, "admin"] as const;

interface PaidUsersTableProps {
  data: PaidUser[];
  total: number;
  counts: PaidUsersResponse["counts"];
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: SortingState;
  states: PaidUserState[];
  tiers: PaidMembershipTier[];
  providers: PaidUserProvider[];
  loading?: boolean;
  refreshing?: boolean;
  onSearch: (value: string) => void;
  onFiltersChange: (value: {
    states: PaidUserState[];
    tiers: PaidMembershipTier[];
    providers: PaidUserProvider[];
  }) => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onRefresh: () => unknown;
  onSortingChange: (value: SortingState) => void;
}

function asFilterValues<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(value)
    ? value.filter((item): item is T => typeof item === "string" && allowed.includes(item as T))
    : [];
}

export function PaidUsersTable({
  data,
  total,
  counts,
  pageIndex,
  pageSize,
  search,
  sorting,
  states,
  tiers,
  providers,
  loading,
  refreshing,
  onSearch,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onSortingChange,
}: PaidUsersTableProps) {
  const t = useTranslations("dashboard.paidUsers");
  const tRoot = useTranslations();
  const [localSearch, setLocalSearch] = useState(search);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(states.length > 0 ? [{ id: "state", value: states }] : []),
      ...(tiers.length > 0 ? [{ id: "membershipTier", value: tiers }] : []),
      ...(providers.length > 0 ? [{ id: "provider", value: providers }] : []),
    ],
    [providers, states, tiers],
  );

  useEffect(() => setLocalSearch(search), [search]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => onSearch(value), 500),
    [onSearch],
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const stateOptions = useMemo<Option[]>(
    () => [
      { label: t("states.paid"), value: "paid", count: counts.paid },
      { label: t("states.trial"), value: "trial", count: counts.trial },
      { label: t("states.ended"), value: "ended", count: counts.ended },
    ],
    [counts, t],
  );
  const tierOptions = useMemo<Option[]>(
    () =>
      (["monthly", "yearly", "lifetime", "credits"] as const).map((tier) => ({
        label: t(`tiers.${tier}`),
        value: tier,
      })),
    [t],
  );
  const providerOptions = useMemo<Option[]>(
    () =>
      paidUserProviders.map((provider) => ({
        label: t(`providers.${provider}`),
        value: provider,
      })),
    [t],
  );
  const columns = usePaidUserColumns();

  // react-doctor-disable-next-line react-hooks-js/incompatible-library -- TanStack Table returns functions that cannot be memoized safely.
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(total / pageSize),
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: (updater) => {
      onSortingChange(typeof updater === "function" ? updater(sorting) : updater);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      onFiltersChange({
        states: asFilterValues(next.find((filter) => filter.id === "state")?.value, [
          "paid",
          "trial",
          "ended",
        ]),
        tiers: asFilterValues(next.find((filter) => filter.id === "membershipTier")?.value, [
          "monthly",
          "yearly",
          "lifetime",
          "credits",
        ]),
        providers: asFilterValues(
          next.find((filter) => filter.id === "provider")?.value,
          paidUserProviders,
        ),
      });
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      if (next.pageSize !== pageSize) onPageSizeChange(next.pageSize);
      else if (next.pageIndex !== pageIndex) onPageChange(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
  });

  const summaryItems = [
    { state: "paid", icon: CircleDollarSign, count: counts.paid },
    { state: "trial", icon: Clock3, count: counts.trial },
    { state: "ended", icon: History, count: counts.ended },
  ] as const;
  const pageCount = Math.ceil(total / pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 shrink-0">
        <div className="flex items-center gap-2 font-semibold leading-none">
          <CircleDollarSign className="size-5" />
          {t("title")}
        </div>
        <div className="mt-1 text-muted-foreground text-sm">{t("description")}</div>
      </div>

      <div className="mb-4 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryItems.map(({ state, icon: Icon, count }) => (
          <div key={state} className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>{t(`states.${state}`)}</span>
              <Icon className="size-4" />
            </div>
            <div className="mt-2 font-semibold text-2xl tabular-nums">{count}</div>
          </div>
        ))}
      </div>

      <DataTableAdvancedToolbar table={table} className="mb-4 shrink-0 items-center p-0">
        <div className="relative">
          <Input
            value={localSearch}
            placeholder={t("table.searchPlaceholder")}
            onChange={(event) => {
              setLocalSearch(event.target.value);
              debouncedSearch(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                debouncedSearch.cancel();
                onSearch(localSearch);
              }
            }}
            className="h-8 w-[260px] pr-8"
          />
          {localSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t("clearSearch")}
              className="absolute right-0 top-0 h-8 w-8 p-0 hover:bg-transparent"
              onClick={() => {
                debouncedSearch.cancel();
                setLocalSearch("");
                onSearch("");
              }}
            >
              <XIcon className="size-3" />
            </Button>
          ) : null}
        </div>
        <DataTableFacetedFilter
          column={table.getColumn("state")}
          title={t("filters.state")}
          options={stateOptions}
          multiple
        />
        <DataTableFacetedFilter
          column={table.getColumn("membershipTier")}
          title={t("filters.tier")}
          options={tierOptions}
          multiple
        />
        <DataTableFacetedFilter
          column={table.getColumn("provider")}
          title={t("filters.provider")}
          options={providerOptions}
          multiple
        />
        <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="mr-2 size-4" />
          )}
          {t("refresh")}
        </Button>
      </DataTableAdvancedToolbar>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRowSkeleton key={index} columns={columns.length} />
                ))
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn("h-16", row.original.user.banned && "bg-muted/40")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("table.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{t("pagination.rowsPerPage")}</span>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger size="sm" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50].map((value) => (
                  <SelectItem key={value} value={`${value}`}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>{t("pagination.total", { total })}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-muted-foreground text-sm">
              {tRoot("dataTable.pagination.currentPage")}
            </span>
            <DataTablePageInput
              page={pageIndex + 1}
              pageCount={pageCount}
              disabled={loading}
              ariaLabel={tRoot("dataTable.pagination.goToPage")}
              onPageChange={(page) => onPageChange(page - 1)}
            />
            <span className="text-muted-foreground text-sm">
              {tRoot("dataTable.pagination.pageCount", { pageCount: Math.max(pageCount, 1) })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pageIndex === 0 || loading}
              aria-label={t("pagination.previous")}
              onClick={() => onPageChange(Math.max(pageIndex - 1, 0))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pageCount === 0 || pageIndex >= pageCount - 1 || loading}
              aria-label={t("pagination.next")}
              onClick={() => onPageChange(pageIndex + 1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
