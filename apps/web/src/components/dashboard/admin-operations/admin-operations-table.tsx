"use no memo";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { debounce } from "lodash-es";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardList,
  Loader2Icon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { DataTablePageInput } from "@/components/data-table/data-table-pagination";
import { useTranslations } from "@/i18n";
import type { Option } from "@/types/data-table";
import { useAdminOperationColumns } from "./admin-operations-columns";
import type { AdminOperation, AdminOperationAction, AdminOperationStatus } from "./types";

interface AdminOperationsTableProps {
  data: AdminOperation[];
  total: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  actions: AdminOperationAction[];
  statuses: AdminOperationStatus[];
  loading: boolean;
  refreshing: boolean;
  onSearch: (value: string) => void;
  onFiltersChange: (value: {
    actions: AdminOperationAction[];
    statuses: AdminOperationStatus[];
  }) => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onRefresh: () => unknown;
}

function asFilterValues<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(value)
    ? value.filter((item): item is T => typeof item === "string" && allowed.includes(item as T))
    : [];
}

const actionValues = ["credits.adjust", "membership.grant_trial"] as const;
const statusValues = ["pending", "succeeded", "failed"] as const;

export function AdminOperationsTable({
  data,
  total,
  pageIndex,
  pageSize,
  search,
  actions,
  statuses,
  loading,
  refreshing,
  onSearch,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: AdminOperationsTableProps) {
  const t = useTranslations("dashboard.adminOperations");
  const tRoot = useTranslations();
  const [localSearch, setLocalSearch] = useState(search);
  const columns = useAdminOperationColumns();
  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(actions.length > 0 ? [{ id: "action", value: actions }] : []),
      ...(statuses.length > 0 ? [{ id: "status", value: statuses }] : []),
    ],
    [actions, statuses],
  );
  const actionOptions = useMemo<Option[]>(
    () => actionValues.map((value) => ({ value, label: t(`actions.${value}`) })),
    [t],
  );
  const statusOptions = useMemo<Option[]>(
    () => statusValues.map((value) => ({ value, label: t(`statuses.${value}`) })),
    [t],
  );
  const debouncedSearch = useMemo(
    () => debounce((value: string) => onSearch(value), 500),
    [onSearch],
  );

  useEffect(() => setLocalSearch(search), [search]);
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // react-doctor-disable-next-line react-hooks-js/incompatible-library -- TanStack Table returns functions that cannot be memoized safely.
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(total / pageSize),
    state: { columnFilters, pagination: { pageIndex, pageSize } },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      onFiltersChange({
        actions: asFilterValues(next.find((filter) => filter.id === "action")?.value, actionValues),
        statuses: asFilterValues(
          next.find((filter) => filter.id === "status")?.value,
          statusValues,
        ),
      });
    },
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
  });
  const pageCount = Math.ceil(total / pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 shrink-0">
        <div className="flex items-center gap-2 font-semibold leading-none">
          <ClipboardList className="size-5" />
          {t("title")}
        </div>
        <div className="mt-1 text-muted-foreground text-sm">{t("description")}</div>
      </div>

      <DataTableAdvancedToolbar table={table} className="mb-4 shrink-0 items-center p-0">
        <div className="relative">
          <Input
            value={localSearch}
            placeholder={t("searchPlaceholder")}
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
            className="h-8 w-[300px] pr-8"
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
          column={table.getColumn("action")}
          title={t("filters.action")}
          options={actionOptions}
          multiple
        />
        <DataTableFacetedFilter
          column={table.getColumn("status")}
          title={t("filters.status")}
          options={statusOptions}
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

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
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
            {!loading && table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  {loading ? t("loading") : t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>{t("pagination.rowsPerPage")}</span>
          <Select value={`${pageSize}`} onValueChange={(value) => onPageSizeChange(Number(value))}>
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
  );
}
