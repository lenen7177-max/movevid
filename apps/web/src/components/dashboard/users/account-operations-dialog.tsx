"use no memo";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "@/i18n";
import { webConfig } from "@/configs/web-config";
import { orpc, queryClient } from "@/utils/orpc";
import type { User } from "./types";
import { usersKeys } from "./use-users";

type OperationView = "credits" | "trial";

export function AccountOperationsDialog({
  open,
  onOpenChange,
  user,
  view,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  view: OperationView;
}) {
  const t = useTranslations("dashboard.users.operations");
  const locale = useLocale();
  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [tier, setTier] = useState<"monthly" | "yearly">("monthly");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, view]);

  const creditBalance = useQuery({
    ...orpc.admin.operations.getCreditBalance.queryOptions({ input: { userId: user.id } }),
    enabled: open && view === "credits" && webConfig.creditsEnabled,
  });
  const trialSchedule = useQuery({
    ...orpc.admin.operations.getTrialSchedule.queryOptions({ input: { userId: user.id } }),
    enabled: open && view === "trial",
  });
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const estimatedTrialEnd = useMemo(() => {
    const days = Number(durationDays);
    if (!Number.isInteger(days) || days <= 0 || trialSchedule.data?.hasPaidMembership) return null;
    const date = new Date(trialSchedule.data?.scheduledThrough ?? Date.now());
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  }, [durationDays, trialSchedule.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: usersKeys.all }),
      queryClient.invalidateQueries({
        queryKey: orpc.admin.operations.getCreditBalance.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.admin.operations.getTrialSchedule.key(),
      }),
      queryClient.invalidateQueries({ queryKey: orpc.admin.operations.list.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.admin.billing.listPaidUsers.key() }),
    ]);
  };

  const adjustMutation = useMutation({
    ...orpc.admin.operations.adjustCredits.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("feedback.creditsAdjusted"));
      setAmount("");
      await refresh();
      onOpenChange(false);
    },
    onError: async (error: Error) => {
      toast.error(t("feedback.failed", { message: error.message }));
      await queryClient.invalidateQueries({ queryKey: orpc.admin.operations.list.key() });
    },
  });
  const trialMutation = useMutation({
    ...orpc.admin.operations.grantTrial.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("feedback.trialGranted"));
      await refresh();
      onOpenChange(false);
    },
    onError: async (error: Error) => {
      toast.error(t("feedback.failed", { message: error.message }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.admin.operations.list.key() }),
        queryClient.invalidateQueries({
          queryKey: orpc.admin.operations.getTrialSchedule.key(),
        }),
      ]);
    },
  });

  const isPending = adjustMutation.isPending || trialMutation.isPending;
  const title = view === "credits" ? t("adjustCredits") : t("grantTrial");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        {view === "credits" ? (
          <div className="grid gap-4">
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <div className="text-muted-foreground text-xs">{t("currentBalance")}</div>
              <div className="mt-1 font-semibold text-2xl tabular-nums">
                {creditBalance.isLoading
                  ? t("balanceLoading")
                  : creditBalance.isError
                    ? t("balanceUnavailable")
                    : creditBalance.data?.balance.toLocaleString()}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="credit-adjustment">{t("amount")}</Label>
              <Input
                id="credit-adjustment"
                inputMode="numeric"
                placeholder={t("amountPlaceholder")}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">{t("amountHelp")}</p>
            </div>
            <ReasonField reason={reason} setReason={setReason} label={t("reasonOptional")} />
          </div>
        ) : null}

        {view === "trial" ? (
          <div className="grid gap-4">
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
              {trialSchedule.isLoading ? (
                <span className="text-muted-foreground">{t("scheduleLoading")}</span>
              ) : trialSchedule.isError ? (
                <span className="text-muted-foreground">{t("scheduleUnavailable")}</span>
              ) : trialSchedule.data?.hasPaidMembership ? (
                <span className="text-destructive">{t("paidMembershipActive")}</span>
              ) : trialSchedule.data?.scheduledThrough ? (
                <span>
                  {t("currentTrialSchedule", {
                    plan:
                      trialSchedule.data.scheduledTier === "yearly" ? t("yearly") : t("monthly"),
                    date: dateFormatter.format(trialSchedule.data.scheduledThrough),
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("noCurrentTrial")}</span>
              )}
              {estimatedTrialEnd ? (
                <div className="mt-1 font-medium">
                  {t("estimatedTrialEnd", { date: dateFormatter.format(estimatedTrialEnd) })}
                </div>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trial-tier">{t("membershipTier")}</Label>
              <Select
                value={tier}
                onValueChange={(value) => {
                  if (value === "monthly" || value === "yearly") setTier(value);
                }}
              >
                <SelectTrigger id="trial-tier" className="w-full">
                  <SelectValue>{tier === "monthly" ? t("monthly") : t("yearly")}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trial-duration">{t("durationDays")}</Label>
              <Input
                id="trial-duration"
                inputMode="numeric"
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
              />
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={durationDays === String(days) ? "default" : "outline"}
                    onClick={() => setDurationDays(String(days))}
                  >
                    {t("days", { count: days })}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("trialAccessDescription", {
                  plan: tier === "monthly" ? t("monthly") : t("yearly"),
                  days: Number(durationDays) || 0,
                })}
              </p>
            </div>
            <ReasonField reason={reason} setReason={setReason} label={t("reasonOptional")} />
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              isPending ||
              (view === "credits" && (!webConfig.creditsEnabled || !Number(amount))) ||
              (view === "trial" && (!Number(durationDays) || trialSchedule.data?.hasPaidMembership))
            }
            onClick={() => {
              if (view === "credits") {
                adjustMutation.mutate({
                  userId: user.id,
                  amount: Number(amount),
                  reason,
                  requestId: crypto.randomUUID(),
                });
              } else {
                trialMutation.mutate({
                  userId: user.id,
                  tier,
                  durationDays: Number(durationDays),
                  reason,
                  requestId: crypto.randomUUID(),
                });
              }
            }}
          >
            {isPending ? t("submitting") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonField({
  label,
  reason,
  setReason,
}: {
  label: string;
  reason: string;
  setReason: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="operation-reason">{label}</Label>
      <textarea
        id="operation-reason"
        className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </div>
  );
}
