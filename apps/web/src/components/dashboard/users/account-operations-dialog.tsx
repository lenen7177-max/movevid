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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import { webConfig } from "@/configs/web-config";
import { orpc, queryClient } from "@/utils/orpc";
import type { User } from "./types";
import { usersKeys } from "./use-users";

export function AccountOperationsDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}) {
  const t = useTranslations("dashboard.users.operations");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const creditBalance = useQuery({
    ...orpc.admin.operations.getCreditBalance.queryOptions({ input: { userId: user.id } }),
    enabled: open && webConfig.creditsEnabled,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: usersKeys.all }),
      queryClient.invalidateQueries({
        queryKey: orpc.admin.operations.getCreditBalance.key(),
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
  const isPending = adjustMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("adjustCredits")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={isPending || !webConfig.creditsEnabled || !Number(amount)}
            onClick={() => {
              adjustMutation.mutate({
                userId: user.id,
                amount: Number(amount),
                reason,
                requestId: crypto.randomUUID(),
              });
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
