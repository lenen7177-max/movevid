import { isVideoTemplateId } from "@repo/app-config/video";
import { createFileRoute } from "@tanstack/react-router";
import { resolveCreditTransactionLabel, resolveCreditTransactionSource } from "@repo/shared";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  ReceiptTextIcon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@repo/ui/button";
import { DataTablePageInput } from "@/components/data-table/data-table-pagination";
import { ContentLoading } from "@/components/feedback/full-screen-loading";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { useCreditTransactionsQuery } from "@/hooks/use-credits";
import { useTranslations } from "@/i18n";

type TransactionFilter = "all" | "purchase" | "usage";
const transactionFilters = ["all", "purchase", "usage"] as const;
const transactionColumnIds = ["type", "package", "source", "amount", "date"] as const;
type TransactionColumnId = (typeof transactionColumnIds)[number];

export const Route = createFileRoute("/_authed/(dashboard)/credits/transactions")({
  component: RouteComponent,
  pendingComponent: ContentLoading,
});

function resolveCreditTransactionSourceLabel(
  t: ReturnType<typeof useTranslations>,
  sourceProvider: string,
) {
  const sourceKey = resolveCreditTransactionSource(sourceProvider);
  return sourceKey === "provider" ? sourceProvider : t(`transactionSources.${sourceKey}`);
}

/** Package name for purchases; template and quality for renders (from the usage row's metadata). */
function resolveCreditTransactionPackageLabel(
  tRoot: ReturnType<typeof useTranslations>,
  item: { packageId: string | null; metadata: Record<string, unknown> | null },
) {
  if (item.packageId) {
    return tRoot(`credits.packages.${item.packageId}.title`);
  }
  const templateId = item.metadata?.templateId;
  if (!isVideoTemplateId(templateId)) {
    return null;
  }
  const name = tRoot(`video.templates.${templateId}.name`);
  const quality = item.metadata?.quality;
  return typeof quality === "string" ? `${name} · ${quality}` : name;
}

function resolveCreditTransactionLabelText(
  t: ReturnType<typeof useTranslations>,
  sourceType: string,
) {
  return t(`transactions.${resolveCreditTransactionLabel(sourceType)}`);
}

function RouteComponent() {
  const t = useTranslations("dashboard.credits");
  const tRoot = useTranslations();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [columnVisibility, setColumnVisibility] = useState<Record<TransactionColumnId, boolean>>({
    type: true,
    package: true,
    source: true,
    amount: true,
    date: true,
  });
  const sourceType = filter === "all" ? undefined : filter;
  const creditTransactionsQuery = useCreditTransactionsQuery(page, perPage, sourceType);
  const transactions = creditTransactionsQuery.data?.data ?? [];
  const total = creditTransactionsQuery.data?.total ?? 0;
  const pageCount = creditTransactionsQuery.data?.pageCount ?? 0;
  const canGoPrevious = page > 1;
  const canGoNext = pageCount > 0 && page < pageCount;
  const visibleColumnCount = transactionColumnIds.filter((id) => columnVisibility[id]).length;
  const canHideColumn = visibleColumnCount > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold leading-none">
            <ReceiptTextIcon className="size-5" />
            {t("transactionsPageTitle")}
          </div>
          <div className="mt-1 text-muted-foreground text-sm">{t("transactionsDescription")}</div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setFilter(value as TransactionFilter);
              setPage(1);
            }}
          >
            <TabsList className="grid w-auto grid-cols-3">
              {transactionFilters.map((item) => (
                <TabsTrigger key={item} value={item}>
                  {t(`transactionFilters.${item}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={creditTransactionsQuery.isFetching}
            onClick={() => void creditTransactionsQuery.refetch()}
          >
            {creditTransactionsQuery.isFetching ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-2 size-4" />
            )}
            {t("refresh")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={tRoot("dataTable.viewOptions.toggleColumns")}
                  role="combobox"
                  variant="outline"
                  size="sm"
                  className="shrink-0 font-normal"
                />
              }
            >
              <Settings2Icon className="text-muted-foreground" />
              {tRoot("dataTable.viewOptions.view")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                {transactionColumnIds.map((id) => (
                  <DropdownMenuCheckboxItem
                    key={id}
                    checked={columnVisibility[id]}
                    disabled={columnVisibility[id] && !canHideColumn}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((current) => ({
                        ...current,
                        [id]: checked === true,
                      }))
                    }
                  >
                    {t(`transactionColumns.${id}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/45 [&::-webkit-scrollbar-track]:bg-transparent">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {columnVisibility.type ? (
                  <TableHead>{t("transactionColumns.type")}</TableHead>
                ) : null}
                {columnVisibility.package ? (
                  <TableHead>{t("transactionColumns.package")}</TableHead>
                ) : null}
                {columnVisibility.source ? (
                  <TableHead>{t("transactionColumns.source")}</TableHead>
                ) : null}
                {columnVisibility.amount ? (
                  <TableHead className="text-right">{t("transactionColumns.amount")}</TableHead>
                ) : null}
                {columnVisibility.date ? (
                  <TableHead className="text-right">{t("transactionColumns.date")}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditTransactionsQuery.isLoading ? (
                Array.from({ length: perPage }).map((_, index) => (
                  <TableRow key={index}>
                    {columnVisibility.type ? (
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ) : null}
                    {columnVisibility.package ? (
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ) : null}
                    {columnVisibility.source ? (
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ) : null}
                    {columnVisibility.amount ? (
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-12" />
                      </TableCell>
                    ) : null}
                    {columnVisibility.date ? (
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-24" />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : transactions.length ? (
                transactions.map((item) => (
                  <TableRow key={item.id}>
                    {columnVisibility.type ? (
                      <TableCell className="font-medium">
                        {resolveCreditTransactionLabelText(t, item.sourceType)}
                      </TableCell>
                    ) : null}
                    {columnVisibility.package ? (
                      <TableCell className="text-muted-foreground">
                        {resolveCreditTransactionPackageLabel(tRoot, item)}
                      </TableCell>
                    ) : null}
                    {columnVisibility.source ? (
                      <TableCell className="text-muted-foreground">
                        {resolveCreditTransactionSourceLabel(t, item.sourceProvider)}
                      </TableCell>
                    ) : null}
                    {columnVisibility.amount ? (
                      <TableCell
                        className={
                          item.amount >= 0
                            ? "text-right font-semibold text-green-600"
                            : "text-right font-semibold text-red-600"
                        }
                      >
                        {item.amount >= 0 ? "+" : ""}
                        {item.amount}
                      </TableCell>
                    ) : null}
                    {columnVisibility.date ? (
                      <TableCell className="text-right text-muted-foreground">
                        {item.createdAt.toLocaleDateString()}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("emptyTransactions")}
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
              value={`${perPage}`}
              onValueChange={(value) => {
                setPerPage(Number(value));
                setPage(1);
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
                page={page}
                pageCount={pageCount}
                disabled={creditTransactionsQuery.isFetching}
                ariaLabel={tRoot("dataTable.pagination.goToPage")}
                onPageChange={setPage}
              />
              <span>
                {tRoot("dataTable.pagination.pageCount", { pageCount: Math.max(pageCount, 1) })}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canGoPrevious || creditTransactionsQuery.isFetching}
              aria-label={t("pagination.previous")}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canGoNext || creditTransactionsQuery.isFetching}
              aria-label={t("pagination.next")}
              onClick={() => setPage((current) => current + 1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
