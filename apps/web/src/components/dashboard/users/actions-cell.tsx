"use no memo";

import { APP_ROLES, type AppRole } from "@repo/app-config/rbac";
import { isPhoneUser } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { useTranslations } from "@/i18n";
import { useDashboardUser } from "@/hooks/use-can";
import { webConfig } from "@/configs/web-config";
import { orpc, queryClient } from "@/utils/orpc";
import type { User } from "./types";
import { usersKeys } from "./use-users";
import { AccountOperationsDialog } from "./account-operations-dialog";

type BlockKind = "email_domain" | "ip" | "device";

export function ActionsCell({ row }: { row: Row<User> }) {
  const t = useTranslations("dashboard.users");
  const tRoles = useTranslations("dashboard.roles");
  const currentUser = useDashboardUser();
  const user = row.original;
  const isSelf = user.id === currentUser.id;
  const isBanned = Boolean(user.banned);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [revokeSignupCredits, setRevokeSignupCredits] = useState(false);
  const [blockKind, setBlockKind] = useState<BlockKind | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const setRoleMutation = useMutation({
    ...orpc.users.setRole.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("actions.setRoleSuccess"));
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error: Error) => {
      toast.error(t("actions.setRoleError", { message: error.message }));
    },
  });

  const banMutation = useMutation({
    ...orpc.users.ban.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("actions.banSuccess"));
      setBanDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error: Error) => {
      toast.error(t("actions.banError", { message: error.message }));
    },
  });

  const blockMutation = useMutation({
    ...orpc.users.blockIdentifier.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("actions.blockSuccess"));
      setBlockKind(null);
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error: Error) => {
      toast.error(t("actions.blockError", { message: error.message }));
    },
  });

  const unbanMutation = useMutation({
    ...orpc.users.unban.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("actions.unbanSuccess"));
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error: Error) => {
      toast.error(t("actions.unbanError", { message: error.message }));
    },
  });

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">{t("actions.openMenu")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {webConfig.creditsEnabled ? (
            <DropdownMenuItem onClick={() => setCreditsOpen(true)}>
              {t("operations.adjustCredits")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isSelf}>
              {t("actions.changeRole")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {APP_ROLES.map((role: AppRole) => (
                <DropdownMenuItem
                  key={role}
                  disabled={user.role === role || setRoleMutation.isPending}
                  onClick={() => {
                    setRoleMutation.mutate({ userId: user.id, role });
                  }}
                >
                  {tRoles(role)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {isPhoneUser(user) ? null : (
            <DropdownMenuItem disabled={isSelf} onClick={() => setBlockKind("email_domain")}>
              {t("actions.blockEmailDomain")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={isSelf} onClick={() => setBlockKind("ip")}>
            {t("actions.blockIp")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isSelf} onClick={() => setBlockKind("device")}>
            {t("actions.blockDevice")}
          </DropdownMenuItem>
          {isBanned ? (
            <DropdownMenuItem
              disabled={isSelf || unbanMutation.isPending}
              onClick={() => {
                unbanMutation.mutate({ userId: user.id });
              }}
            >
              {t("actions.unban")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onClick={() => setBanDialogOpen(true)}
            >
              {t("actions.ban")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {menu}

      <ConfirmDialog
        open={banDialogOpen}
        onOpenChange={(nextOpen) => {
          setBanDialogOpen(nextOpen);
          if (!nextOpen) setRevokeSignupCredits(false);
        }}
        title={t("actions.banConfirmTitle")}
        desc={t("actions.banConfirmDescription")}
        confirmText={t("actions.ban")}
        destructive
        isLoading={banMutation.isPending}
        handleConfirm={() => {
          banMutation.mutate({
            userId: user.id,
            ...(webConfig.creditsEnabled ? { revokeSignupCredits } : {}),
          });
        }}
      >
        {webConfig.creditsEnabled ? (
          <div className="flex items-center gap-2 px-1 text-sm">
            <Checkbox
              id={`revoke-signup-credits-${user.id}`}
              checked={revokeSignupCredits}
              onCheckedChange={(checked) => setRevokeSignupCredits(checked === true)}
            />
            <label htmlFor={`revoke-signup-credits-${user.id}`}>
              {t("actions.revokeSignupCredits")}
            </label>
          </div>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={blockKind !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setBlockKind(null);
        }}
        title={blockKind ? t(`actions.blockConfirmTitle.${blockKind}`) : ""}
        desc={blockKind ? t(`actions.blockConfirmDescription.${blockKind}`) : ""}
        confirmText={t("actions.blockConfirm")}
        destructive
        isLoading={blockMutation.isPending}
        handleConfirm={() => {
          if (!blockKind) return;
          blockMutation.mutate({ userId: user.id, kind: blockKind });
        }}
      />
      {creditsOpen ? (
        <AccountOperationsDialog open onOpenChange={setCreditsOpen} user={user} />
      ) : null}
    </>
  );
}
