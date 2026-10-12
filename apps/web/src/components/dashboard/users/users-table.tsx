"use no memo";

import { APP_ROLES, type AppRole } from "@repo/app-config/rbac";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { getVisibleUserContact, getVisibleUserName, isPhoneUser } from "@repo/shared";
import { webConfig } from "@/configs/web-config";
import { debounce } from "lodash-es";
import {
  CheckCircle2,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  Mail,
  RefreshCwIcon,
  Smartphone,
  UsersIcon,
  XCircle,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { DataTablePageInput } from "@/components/data-table/data-table-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { useTranslations } from "@/i18n";
import { ActionsCell } from "./actions-cell";
import { RoleBadge } from "./role-badge";
import { TableRowSkeleton } from "./table-row-skeleton";
import type { User } from "./types";

const SIGNUP_GRANT_REASONS = [
  "eligible",
  "identity_already_granted",
  "device_already_granted",
  "ip_limit",
  "blocklisted",
  "user_agent_limit",
] as const;

function signupGrantReasonKey(reason: string) {
  if (SIGNUP_GRANT_REASONS.some((item) => item === reason)) {
    return `table.signupReasons.${reason}` as const;
  }
  return null;
}

interface UsersTableProps {
  data: User[];
  total: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  roles: AppRole[];
  sorting: SortingState;
  loading?: boolean;
  refreshing?: boolean;
  onSearch: (search: string) => void;
  onRolesChange: (roles: AppRole[]) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh?: () => void;
  onSortingChange?: (sorting: SortingState) => void;
}

export function UsersTable({
  data,
  total,
  pageIndex,
  pageSize,
  search,
  roles,
  sorting,
  loading,
  refreshing,
  onSearch,
  onRolesChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onSortingChange,
}: UsersTableProps) {
  const t = useTranslations("dashboard.users");
  const tRoles = useTranslations("dashboard.roles");
  const tRoot = useTranslations();
  const showActions = true;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [localSearch, setLocalSearch] = useState(search);

  const columnFilters = useMemo<ColumnFiltersState>(
    () => (roles.length > 0 ? [{ id: "role", value: roles }] : []),
    [roles],
  );

  // Sync local search with prop when it changes externally
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search using lodash (500ms as fallback)
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onSearch(value);
        onPageChange(0);
      }, 500),
    [onSearch, onPageChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  // Immediate search on Enter key
  const handleSearchSubmit = useCallback(() => {
    debouncedSearch.cancel();
    onSearch(localSearch);
    onPageChange(0);
  }, [debouncedSearch, localSearch, onSearch, onPageChange]);

  const roleFilterOptions = useMemo(
    () =>
      APP_ROLES.map((role) => ({
        label: tRoles(role),
        value: role,
      })),
    [tRoles],
  );

  const columns: ColumnDef<User>[] = useMemo(() => {
    const cols: ColumnDef<User>[] = [
      {
        id: "avatar",
        accessorKey: "image",
        header: ({ column }) => <DataTableColumnHeader column={column} label={t("table.avatar")} />,
        cell: ({ row }) => {
          const user = row.original;
          const visibleName = getVisibleUserName(user);
          const visibleContact = getVisibleUserContact(user);
          const fallback = (visibleName ?? visibleContact)?.slice(0, 2).toUpperCase() ?? "??";

          return (
            <div className="flex items-center">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  alt={visibleName ?? visibleContact ?? ""}
                  src={user.image ?? undefined}
                />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
            </div>
          );
        },
        meta: {
          label: t("table.avatar"),
        },
        enableSorting: false,
        minSize: 120,
        size: 140,
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} label={t("table.name")} />,
        cell: ({ row }) => {
          const user = row.original;
          return <div className="font-medium">{getVisibleUserName(user)}</div>;
        },
        meta: {
          label: t("table.name"),
        },
        minSize: 120,
        size: 140,
      },
      {
        id: "contact",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={t("table.contact")} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const phoneUser = isPhoneUser(user);
          const Icon = phoneUser ? Smartphone : Mail;
          const contact = phoneUser ? user.phoneNumber : getVisibleUserContact(user);

          return (
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" />
              <span>{contact ?? "-"}</span>
            </div>
          );
        },
        meta: {
          label: t("table.contact"),
        },
        enableSorting: false,
        minSize: 180,
        size: 200,
      },
      {
        id: "role",
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} label={t("table.role")} />,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
        meta: {
          label: t("table.role"),
        },
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: () => true,
        minSize: 100,
        size: 120,
      },
      {
        id: "banned",
        accessorKey: "banned",
        header: ({ column }) => <DataTableColumnHeader column={column} label={t("table.ban")} />,
        cell: ({ row }) => {
          if (!row.original.banned) {
            return <span className="text-muted-foreground text-sm">{t("table.active")}</span>;
          }
          return <Badge variant="destructive">{t("table.banned")}</Badge>;
        },
        meta: {
          label: t("table.ban"),
        },
        enableSorting: false,
        minSize: 100,
        size: 120,
      },
      {
        id: "emailVerified",
        accessorKey: "emailVerified",
        header: t("table.status"),
        cell: ({ row }) => {
          const user = row.original;
          const verified = isPhoneUser(user) ? user.phoneNumberVerified : user.emailVerified;
          const Icon = verified ? CheckCircle2 : XCircle;

          return (
            <Badge variant="outline" className="capitalize">
              <Icon className={verified ? "stroke-green-500" : "stroke-red-500"} />
              {verified ? t("table.verified") : t("table.unverified")}
            </Badge>
          );
        },
        meta: {
          label: t("table.status"),
        },
        enableSorting: false,
        minSize: 100,
        size: 120,
      },
    ];

    if (webConfig.creditsEnabled) {
      cols.push({
        id: "signupGrant",
        header: t("table.signupGrant"),
        cell: ({ row }) => {
          const grant = row.original.signupGrant;
          if (!grant) {
            return (
              <span className="text-muted-foreground text-sm">{t("table.signupPending")}</span>
            );
          }
          if (grant.status === "granted") {
            return <Badge variant="outline">{t("table.signupGranted")}</Badge>;
          }
          const reasonKey = signupGrantReasonKey(grant.reason);
          return <Badge variant="secondary">{reasonKey ? t(reasonKey) : grant.reason}</Badge>;
        },
        meta: {
          label: t("table.signupGrant"),
        },
        enableSorting: false,
        minSize: 140,
        size: 180,
      });
    }

    if (showActions) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">{t("table.actions")}</span>,
        cell: ({ row }) => <ActionsCell row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 56,
      });
    }

    return cols;
  }, [showActions, t]);

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
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange?.(next);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      const roleFilter = next.find((filter) => filter.id === "role");
      const nextRoles = Array.isArray(roleFilter?.value)
        ? (roleFilter.value.filter((value): value is AppRole =>
            APP_ROLES.includes(value as AppRole),
          ) as AppRole[])
        : [];
      onRolesChange(nextRoles);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      if (next.pageSize !== pageSize) {
        onPageSizeChange(next.pageSize);
        if (pageIndex !== 0) onPageChange(0);
      } else if (next.pageIndex !== pageIndex) {
        onPageChange(next.pageIndex);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
  });
  const pageCount = Math.ceil(total / pageSize);
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageCount > 0 && pageIndex < pageCount - 1;
  const roleColumn = table.getColumn("role");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold leading-none">
            <UsersIcon className="size-5" />
            {t("title")}
          </div>
          <div className="mt-1 text-muted-foreground text-sm">{t("description")}</div>
        </div>
        <DataTableAdvancedToolbar table={table} className="shrink-0 items-center p-0 sm:w-auto">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative">
              <Input
                placeholder={t("table.searchPlaceholder")}
                value={localSearch}
                onChange={(event) => handleSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearchSubmit();
                  }
                }}
                className="h-8 w-[260px] pr-8"
              />
              {localSearch.length > 0 ? (
                <Button
                  aria-label="Clear search"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    debouncedSearch.cancel();
                    setLocalSearch("");
                    onSearch("");
                    onPageChange(0);
                  }}
                  className="absolute right-0 top-0 h-8 w-8 p-0 hover:bg-transparent"
                >
                  <XIcon className="size-3" />
                </Button>
              ) : null}
            </div>
            {roleColumn ? (
              <DataTableFacetedFilter
                column={roleColumn}
                title={t("table.role")}
                options={roleFilterOptions}
                multiple
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={refreshing}
              onClick={onRefresh}
            >
              {refreshing ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="mr-2 size-4" />
              )}
              {t("refresh")}
            </Button>
          </div>
        </DataTableAdvancedToolbar>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/45 [&::-webkit-scrollbar-track]:bg-transparent">
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
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={
                      row.original.banned ? "h-14 bg-muted/40 text-muted-foreground" : "h-14"
                    }
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
        <div className="mt-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{t("pagination.rowsPerPage")}</span>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
                if (pageIndex !== 0) onPageChange(0);
              }}
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
            <span>
              {t("pagination.total", {
                total,
              })}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span>{tRoot("dataTable.pagination.currentPage")}</span>
              <DataTablePageInput
                page={pageIndex + 1}
                pageCount={pageCount}
                disabled={loading}
                ariaLabel={tRoot("dataTable.pagination.goToPage")}
                onPageChange={(nextPage) => onPageChange(nextPage - 1)}
              />
              <span>
                {tRoot("dataTable.pagination.pageCount", { pageCount: Math.max(pageCount, 1) })}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canGoPrevious || loading}
              aria-label={t("pagination.previous")}
              onClick={() => onPageChange(Math.max(pageIndex - 1, 0))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canGoNext || loading}
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
