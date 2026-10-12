"use no memo";

import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { getSortingStateParser } from "@/lib/parsers";
import type { ExtendedColumnSort, QueryKeys } from "@/types/data-table";

const PAGE_KEY = "page";
const PER_PAGE_KEY = "perPage";
const SORT_KEY = "sort";
const FILTERS_KEY = "filters";
const JOIN_OPERATOR_KEY = "joinOperator";
const ARRAY_SEPARATOR = ",";
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;

type SearchRecord = Record<string, unknown>;

interface UseDataTableProps<TData>
  extends
    Omit<
      TableOptions<TData>,
      | "state"
      | "pageCount"
      | "getCoreRowModel"
      | "manualFiltering"
      | "manualPagination"
      | "manualSorting"
    >,
    Required<Pick<TableOptions<TData>, "pageCount">> {
  initialState?: Omit<Partial<TableState>, "sorting"> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  queryKeys?: Partial<QueryKeys>;
  history?: "push" | "replace";
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  enableAdvancedFilter?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
}

export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  "use no memo";
  const {
    columns,
    pageCount = -1,
    initialState,
    queryKeys,
    history = "replace",
    debounceMs = DEBOUNCE_MS,
    throttleMs = THROTTLE_MS,
    clearOnDefault = false,
    enableAdvancedFilter = false,
    ...tableProps
  } = props;

  const pageKey = queryKeys?.page ?? PAGE_KEY;
  const perPageKey = queryKeys?.perPage ?? PER_PAGE_KEY;
  const sortKey = queryKeys?.sort ?? SORT_KEY;
  const filtersKey = queryKeys?.filters ?? FILTERS_KEY;
  const joinOperatorKey = queryKeys?.joinOperator ?? JOIN_OPERATOR_KEY;

  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SearchRecord;

  const defaultPageSize = initialState?.pagination?.pageSize ?? 10;

  // Helper to update search params
  const updateSearch = React.useCallback(
    (updates: SearchRecord) => {
      navigate({
        to: ".",
        search: (prev) => {
          const next = { ...(prev as SearchRecord) };
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === null) {
              delete next[key];
            } else {
              next[key] = value;
            }
          }
          return next;
        },
        replace: history === "replace",
      });
    },
    [navigate, history],
  );

  const debouncedUpdateSearch = useDebouncedCallback(updateSearch, debounceMs);

  // Row selection state (local only)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {},
  );

  // Column visibility state (local only)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState?.columnVisibility ?? {},
  );

  // Pagination from URL
  const page = React.useMemo(() => {
    const rawPage = search[pageKey];
    return typeof rawPage === "number" ? rawPage : 1;
  }, [search, pageKey]);

  const perPage = React.useMemo(() => {
    const rawPerPage = search[perPageKey];
    return typeof rawPerPage === "number" ? rawPerPage : defaultPageSize;
  }, [search, perPageKey, defaultPageSize]);

  const pagination: PaginationState = React.useMemo(() => {
    return {
      pageIndex: page - 1,
      pageSize: perPage,
    };
  }, [page, perPage]);

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      const newPagination =
        typeof updaterOrValue === "function" ? updaterOrValue(pagination) : updaterOrValue;

      const newPage = newPagination.pageIndex + 1;
      const newPerPage = newPagination.pageSize;

      updateSearch({
        [pageKey]: clearOnDefault && newPage === 1 ? undefined : newPage,
        [perPageKey]: clearOnDefault && newPerPage === defaultPageSize ? undefined : newPerPage,
      });
    },
    [pagination, updateSearch, pageKey, perPageKey, clearOnDefault, defaultPageSize],
  );

  // Sorting from URL
  const columnIds = React.useMemo(() => {
    return new Set(columns.map((column) => column.id).filter(Boolean) as string[]);
  }, [columns]);

  const sortingParser = React.useMemo(() => getSortingStateParser<TData>(columnIds), [columnIds]);

  const sorting = React.useMemo(() => {
    const rawSort = search[sortKey];
    if (typeof rawSort === "string") {
      const parsed = sortingParser.parse(rawSort);
      return parsed ?? initialState?.sorting ?? [];
    }
    return initialState?.sorting ?? [];
  }, [search, sortKey, sortingParser, initialState?.sorting]);

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      const newSorting =
        typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;

      const serialized =
        newSorting.length > 0
          ? sortingParser.serialize(newSorting as ExtendedColumnSort<TData>[])
          : undefined;

      updateSearch({
        [sortKey]: serialized,
        [pageKey]: clearOnDefault ? undefined : 1,
      });
    },
    [sorting, sortingParser, updateSearch, sortKey, pageKey, clearOnDefault],
  );

  // Column filters
  const filterableColumns = React.useMemo(() => {
    if (enableAdvancedFilter) return [];
    return columns.filter((column) => column.enableColumnFilter);
  }, [columns, enableAdvancedFilter]);

  const initialColumnFilters: ColumnFiltersState = React.useMemo(() => {
    if (enableAdvancedFilter) return [];

    return filterableColumns.reduce<ColumnFiltersState>((filters, column) => {
      const columnId = column.id ?? "";
      const rawValue = search[columnId];

      if (rawValue !== undefined && rawValue !== null) {
        let processedValue: string | string[];

        if (column.meta?.options) {
          // Array filter
          if (typeof rawValue === "string") {
            processedValue = rawValue.split(ARRAY_SEPARATOR).filter(Boolean);
          } else if (Array.isArray(rawValue)) {
            processedValue = rawValue.filter(Boolean) as string[];
          } else {
            return filters;
          }
        } else {
          // String filter
          if (typeof rawValue === "string") {
            processedValue = rawValue;
          } else {
            return filters;
          }
        }

        if (
          (Array.isArray(processedValue) && processedValue.length > 0) ||
          (typeof processedValue === "string" && processedValue !== "")
        ) {
          filters.push({
            id: columnId,
            value: processedValue,
          });
        }
      }
      return filters;
    }, []);
  }, [search, filterableColumns, enableAdvancedFilter]);

  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters);

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return;

      setColumnFilters((prev) => {
        const next = typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue;

        const filterUpdates: SearchRecord = {
          [pageKey]: clearOnDefault ? undefined : 1,
        };

        // Add/update filters
        for (const filter of next) {
          const column = filterableColumns.find((col) => col.id === filter.id);
          if (column) {
            if (Array.isArray(filter.value)) {
              filterUpdates[filter.id] =
                filter.value.length > 0 ? filter.value.join(ARRAY_SEPARATOR) : undefined;
            } else {
              filterUpdates[filter.id] = filter.value || undefined;
            }
          }
        }

        // Remove cleared filters
        for (const prevFilter of prev) {
          if (!next.some((filter) => filter.id === prevFilter.id)) {
            filterUpdates[prevFilter.id] = undefined;
          }
        }

        debouncedUpdateSearch(filterUpdates);
        return next;
      });
    },
    [debouncedUpdateSearch, filterableColumns, enableAdvancedFilter, pageKey, clearOnDefault],
  );

  // react-doctor-disable-next-line react-hooks-js/incompatible-library -- TanStack Table returns functions that cannot be memoized safely.
  const table = useReactTable({
    ...tableProps,
    columns,
    initialState,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    defaultColumn: {
      ...tableProps.defaultColumn,
      enableColumnFilter: false,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    meta: {
      ...tableProps.meta,
      queryKeys: {
        page: pageKey,
        perPage: perPageKey,
        sort: sortKey,
        filters: filtersKey,
        joinOperator: joinOperatorKey,
      },
    },
  });

  return React.useMemo(() => ({ table, debounceMs, throttleMs }), [table, debounceMs, throttleMs]);
}
