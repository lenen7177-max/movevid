import { Badge } from "@repo/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useLocale, useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import type { AdminOperation } from "./types";

export function useAdminOperationColumns(): ColumnDef<AdminOperation>[] {
  const t = useTranslations("dashboard.adminOperations");
  const locale = useLocale();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  return useMemo<ColumnDef<AdminOperation>[]>(
    () => [
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: t("table.time"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground text-sm">
            {dateFormatter.format(row.original.createdAt)}
          </span>
        ),
        meta: { label: t("table.time") },
      },
      {
        id: "actor",
        accessorKey: "actorEmail",
        header: t("table.operator"),
        cell: ({ row }) => <span className="font-medium">{row.original.actorEmail}</span>,
        meta: { label: t("table.operator") },
      },
      {
        id: "target",
        accessorKey: "targetName",
        header: t("table.target"),
        cell: ({ row }) => <span>{row.original.targetName || t("unknownUser")}</span>,
        meta: { label: t("table.target") },
      },
      {
        id: "action",
        accessorKey: "action",
        header: t("table.action"),
        cell: ({ row }) => <Badge variant="outline">{t(`actions.${row.original.action}`)}</Badge>,
        meta: { label: t("table.action") },
        enableColumnFilter: true,
        filterFn: () => true,
      },
      {
        id: "details",
        accessorFn: (operation) => operation.metadata,
        header: t("table.details"),
        cell: ({ row }) => {
          const operation = row.original;
          if (!operation.metadata) return <span className="text-muted-foreground">—</span>;
          if (operation.action === "credits.adjust") {
            const amount = Number(operation.metadata.amount ?? 0);
            return t(amount > 0 ? "summaries.creditsAdded" : "summaries.creditsDeducted", {
              amount: Math.abs(amount),
            });
          }
          return t(
            operation.metadata.previousExpiresAt ? "summaries.trialExtended" : "summaries.trial",
            {
              tier: operation.metadata.tier === "yearly" ? t("tiers.yearly") : t("tiers.monthly"),
              days: Number(operation.metadata.durationDays ?? 0),
            },
          );
        },
        meta: { label: t("table.details") },
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("table.status"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              row.original.status === "succeeded" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
              row.original.status === "pending" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-700",
              row.original.status === "failed" &&
                "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {t(`statuses.${row.original.status}`)}
          </Badge>
        ),
        meta: { label: t("table.status") },
        enableColumnFilter: true,
        filterFn: () => true,
      },
      {
        id: "reason",
        accessorFn: (operation) => operation.reason ?? operation.errorMessage,
        header: t("table.reason"),
        cell: ({ row }) => {
          const operation = row.original;
          return (
            <div className="max-w-64 text-sm">
              {operation.reason ? <div>{operation.reason}</div> : null}
              {operation.errorMessage ? (
                <div className="text-destructive">{operation.errorMessage}</div>
              ) : null}
              {!operation.reason && !operation.errorMessage ? (
                <span className="text-muted-foreground">—</span>
              ) : null}
            </div>
          );
        },
        meta: { label: t("table.reason") },
      },
    ],
    [dateFormatter, t],
  );
}
