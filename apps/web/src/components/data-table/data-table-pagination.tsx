"use no memo";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import * as React from "react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn } from "@/lib/utils";

const PAGE_CHANGE_DEBOUNCE_MS = 500;

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

interface DataTablePageInputProps {
  page: number;
  pageCount: number;
  disabled?: boolean;
  ariaLabel: string;
  onPageChange: (page: number) => void;
}

export function DataTablePageInput({
  page,
  pageCount,
  disabled,
  ariaLabel,
  onPageChange,
}: DataTablePageInputProps) {
  const [value, setValue] = React.useState(`${page}`);
  const debouncedPageChange = useDebouncedCallback(onPageChange, PAGE_CHANGE_DEBOUNCE_MS);

  React.useEffect(() => {
    setValue(`${page}`);
    debouncedPageChange.cancel();
  }, [debouncedPageChange, page]);

  const getValidPage = React.useCallback(
    (nextValue: string) => {
      const nextPage = Number(nextValue);

      return Number.isInteger(nextPage) && nextPage >= 1 && nextPage <= pageCount ? nextPage : null;
    },
    [pageCount],
  );

  const submitPage = React.useCallback(() => {
    debouncedPageChange.cancel();
    const nextPage = getValidPage(value);

    if (nextPage === null) {
      setValue(`${page}`);
      return;
    }

    if (nextPage !== page) onPageChange(nextPage);
  }, [debouncedPageChange, getValidPage, onPageChange, page, value]);

  return (
    <Input
      aria-label={ariaLabel}
      type="number"
      inputMode="numeric"
      min={1}
      max={Math.max(pageCount, 1)}
      value={value}
      disabled={disabled || pageCount < 1}
      onChange={(event) => {
        const nextValue = event.target.value;
        setValue(nextValue);

        const nextPage = getValidPage(nextValue);
        if (nextPage === null || nextPage === page) {
          debouncedPageChange.cancel();
          return;
        }

        debouncedPageChange(nextPage);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitPage();
        }
      }}
      className="h-8 w-14 px-2 text-center tabular-nums"
    />
  );
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-end gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-18 data-size:h-8">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center font-medium text-sm">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
