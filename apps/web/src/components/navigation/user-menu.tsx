import { Link, useHydrated } from "@tanstack/react-router";
import { useTranslations } from "@/i18n";
import { openSignInDialog } from "@/components/auth/sign-in-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/skeleton";
import useDialogState from "@/hooks/use-dialog-state";
import { authClient } from "@/lib/auth/auth-client";
import { isGuestUser } from "@/lib/auth/guest-session";
import { SignOutDialog } from "../auth/sign-out-dialog";

type UserMenuProps = {
  onActionComplete?: () => void;
};

export default function UserMenu({ onActionComplete }: UserMenuProps = {}) {
  const { data: session, isPending } = authClient.useSession();
  // The server always renders the skeleton (it doesn't know the session); keep it until hydration
  // so the first client render matches and React doesn't throw away the header.
  const hydrated = useHydrated();
  const user = session?.user;
  // Guests keep their videos and credits in this browser; signing in saves them to an account.
  const guest = isGuestUser(user);
  const [open, setOpen] = useDialogState();
  const t = useTranslations("common");

  const completeAction = () => {
    if (!onActionComplete) return;
    window.requestAnimationFrame(() => {
      onActionComplete();
    });
  };

  if (!hydrated || isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          openSignInDialog();
          completeAction();
        }}
      >
        {t("signIn")}
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton={false}
          render={<Avatar className="h-8 w-8 rounded-lg" />}
        >
          <AvatarImage alt={user?.name ?? ""} src={user?.image ?? ""} />
          <AvatarFallback className="rounded-lg">
            {user?.name?.slice(0, 2).toUpperCase() || "CN"}
          </AvatarFallback>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* dashboard: opens credits */}
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link to="/credits/purchase" onClick={completeAction} />}>
              <div className="flex items-center gap-2.5">
                <p className="text-sm">{t("dashboard")}</p>
              </div>
            </DropdownMenuItem>
            {/* history: the user's renders */}
            <DropdownMenuItem render={<Link to="/works" onClick={completeAction} />}>
              <div className="flex items-center gap-2.5">
                <p className="text-sm">{t("history")}</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {guest ? (
              <DropdownMenuItem
                onClick={() => {
                  openSignInDialog();
                  completeAction();
                }}
              >
                <div className="flex items-center gap-2.5">
                  <p className="text-sm">{t("guestSignIn")}</p>
                </div>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setOpen(true);
                  completeAction();
                }}
              >
                <div className="flex items-center gap-2.5">
                  <p className="text-sm">{t("signOut")}</p>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog onOpenChange={setOpen} open={!!open} />
    </>
  );
}
