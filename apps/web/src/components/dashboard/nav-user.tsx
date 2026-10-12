import { IconDotsVertical } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Home, LogOut } from "lucide-react";
import { SignOutDialog } from "@/components/auth/sign-out-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@repo/ui/sidebar";
import useDialogState from "@/hooks/use-dialog-state";
import { useTranslations } from "@/i18n";
import type { CurrentUser } from "@/lib/auth/auth-server";
import { UserInfo } from "../shared/user-info";

export function NavUser({ user }: { user: CurrentUser }) {
  const t = useTranslations("dashboard.nav");
  const { isMobile } = useSidebar();
  const [open, setOpen] = useDialogState();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  size="lg"
                />
              }
            >
              <UserInfo user={user} />
              <IconDotsVertical className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-(--anchor-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} />
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link to="/" />}>
                  <Home />
                  {t("home")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link to="/settings/profile" />}>
                  <BadgeCheck />
                  {t("profile")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setOpen(true)} variant="destructive">
                  <LogOut />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog onOpenChange={setOpen} open={!!open} />
    </>
  );
}
