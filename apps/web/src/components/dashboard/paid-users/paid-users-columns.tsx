import { formatCurrency, getVisibleUserContact, getVisibleUserName } from "@repo/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { useLocale, useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { useChannelLabel } from "./acquisition-summary";
import type { PaidUser } from "./types";

export function usePaidUserColumns(): ColumnDef<PaidUser>[] {
  const t = useTranslations("dashboard.paidUsers");
  const channelLabel = useChannelLabel();
  const locale = useLocale();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  return useMemo<ColumnDef<PaidUser>[]>(
    () => [
      {
        id: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} label={t("table.user")} />,
        cell: ({ row }) => {
          const { user } = row.original;
          const visibleName = getVisibleUserName(user) ?? user.name;
          const visibleContact = getVisibleUserContact(user) ?? user.email;
          const fallback = (visibleName || visibleContact).slice(0, 2).toUpperCase();
          return (
            <div className="flex min-w-56 items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={user.image ?? undefined} alt={visibleName} />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{visibleName}</span>
                  {user.banned ? <Badge variant="destructive">{t("accountBanned")}</Badge> : null}
                </div>
                <div className="truncate text-muted-foreground text-xs">{visibleContact}</div>
              </div>
            </div>
          );
        },
        meta: { label: t("table.user") },
        minSize: 240,
      },
      {
        id: "membershipTier",
        accessorKey: "membershipTier",
        header: t("table.membership"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="min-w-28">
              <div className="font-medium">
                {item.membershipTier ? t(`tiers.${item.membershipTier}`) : item.planId}
              </div>
              <div className="text-muted-foreground text-xs">{t(`sources.${item.source}`)}</div>
            </div>
          );
        },
        meta: { label: t("table.membership") },
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: () => true,
      },
      {
        id: "listPrice",
        header: t("table.listPrice"),
        cell: ({ row }) => {
          const item = row.original;
          if (!item.listPrice) {
            if (item.source === "credits") {
              return <span className="text-muted-foreground text-sm">—</span>;
            }
            if (item.source === "admin_trial") {
              return <span className="text-muted-foreground text-sm">{t("complimentary")}</span>;
            }
            return (
              <div className="min-w-32">
                <div className="text-muted-foreground text-sm">{t("priceUnavailable")}</div>
                <div className="font-mono text-muted-foreground text-xs">{item.priceId}</div>
              </div>
            );
          }
          const interval = item.listPrice.interval
            ? t(`intervals.${item.listPrice.interval}`)
            : null;
          return (
            <div className="min-w-24">
              <div className="font-medium tabular-nums">
                {formatCurrency(item.listPrice.amountCents, item.listPrice.currency)}
              </div>
              <div className="text-muted-foreground text-xs">{interval ?? t("oneTime")}</div>
            </div>
          );
        },
        meta: { label: t("table.listPrice") },
        enableSorting: false,
      },
      {
        id: "creditPurchases",
        header: t("table.creditPurchases"),
        cell: ({ row }) => {
          const purchases = row.original.creditPurchases;
          if (!purchases) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <div className="min-w-28">
              <div className="font-medium tabular-nums">
                {formatCurrency(purchases.amountCents, purchases.currency)}
              </div>
              <div className="text-muted-foreground text-xs">
                {t("creditPurchasesSummary", {
                  count: purchases.count,
                  credits: purchases.credits,
                })}
              </div>
            </div>
          );
        },
        meta: { label: t("table.creditPurchases") },
        enableSorting: false,
      },
      {
        id: "acquisition",
        header: t("table.source"),
        cell: ({ row }) => {
          const acquisition = row.original.acquisition;
          if (!acquisition) {
            return (
              <span className="text-muted-foreground text-sm" title={t("sourceUnknown")}>
                —
              </span>
            );
          }
          const detail = acquisition.utmSource
            ? [acquisition.utmSource, acquisition.utmCampaign].filter(Boolean).join(" / ")
            : acquisition.referrerHost;
          return (
            <div className="min-w-24 space-y-1">
              <Badge variant="secondary">{channelLabel(acquisition.channel)}</Badge>
              {detail ? (
                <div className="text-muted-foreground max-w-40 truncate text-xs">{detail}</div>
              ) : null}
              {acquisition.landingPath ? (
                <div className="text-muted-foreground max-w-40 truncate text-xs">
                  {acquisition.landingPath}
                </div>
              ) : null}
            </div>
          );
        },
        meta: { label: t("table.source") },
        enableSorting: false,
      },
      {
        id: "provider",
        accessorKey: "provider",
        header: t("table.provider"),
        cell: ({ row }) => (
          <Badge variant="outline">{t(`providers.${row.original.provider}`)}</Badge>
        ),
        meta: { label: t("table.provider") },
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: () => true,
      },
      {
        id: "state",
        accessorKey: "state",
        header: t("table.status"),
        cell: ({ row }) => {
          const item = row.original;
          const statusLabel = item.cancelAtPeriodEnd
            ? t("statuses.canceling")
            : t(`statuses.${item.billingStatus}`);
          return (
            <div className="min-w-28">
              <Badge
                variant="outline"
                className={cn(
                  item.state === "paid" &&
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                  item.state === "trial" && "border-blue-500/30 bg-blue-500/10 text-blue-700",
                  item.state === "ended" && "text-muted-foreground",
                )}
              >
                {t(`states.${item.state}`)}
              </Badge>
              <div className="mt-1 text-muted-foreground text-xs">{statusLabel}</div>
            </div>
          );
        },
        meta: { label: t("table.status") },
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: () => true,
      },
      {
        id: "startedOrPaidAt",
        header: t("table.startedOrPaidAt"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {dateFormatter.format(row.original.startedOrPaidAt)}
          </span>
        ),
        meta: { label: t("table.startedOrPaidAt") },
        enableSorting: false,
      },
      {
        id: "currentPeriodEnd",
        header: t("table.renewal"),
        cell: ({ row }) => {
          const item = row.original;
          if (item.source === "lifetime" || item.source === "credits") {
            return <span className="text-muted-foreground text-sm">{t("notApplicable")}</span>;
          }
          if (!item.currentPeriodEnd) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <div className="min-w-36">
              <div className="whitespace-nowrap text-sm">
                {dateFormatter.format(item.currentPeriodEnd)}
              </div>
              <div className="text-muted-foreground text-xs">
                {item.source === "admin_trial" || item.cancelAtPeriodEnd
                  ? t("endsAtPeriod")
                  : t("renewsAtPeriod")}
              </div>
            </div>
          );
        },
        meta: { label: t("table.renewal") },
        enableSorting: false,
      },
      {
        id: "latestBillingAt",
        accessorKey: "latestBillingAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={t("table.latestBillingAt")} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground text-sm">
            {dateFormatter.format(row.original.latestBillingAt)}
          </span>
        ),
        meta: { label: t("table.latestBillingAt") },
      },
    ],
    [channelLabel, dateFormatter, t],
  );
}
