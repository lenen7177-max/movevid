import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTranslations } from "@/i18n";

interface SignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const t = useTranslations("dashboard.nav.signOutDialog");
  const commonT = useTranslations("common");
  const { signOut } = useSignOut();

  return (
    <ConfirmDialog
      className="sm:max-w-sm"
      confirmText={t("confirm")}
      desc={t("description")}
      destructive
      handleConfirm={signOut}
      onOpenChange={onOpenChange}
      open={open}
      title={t("title")}
      cancelBtnText={commonT("cancel")}
    />
  );
}
