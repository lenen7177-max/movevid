import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import React from "react";
import { useSearch } from "@/components/providers/search-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/command";
import { ScrollArea } from "@repo/ui/scroll-area";
import { sidebarData } from "@/configs/data/sidebar-data";
import { useDashboardUser } from "@/hooks/use-can";
import { useTranslations } from "@/i18n";
import { filterNavGroups, getMinimumRoleForPermission } from "@/lib/rbac";

export function CommandMenu() {
  const navigate = useNavigate();
  const { open, setOpen } = useSearch();
  const t = useTranslations();
  const user = useDashboardUser();
  const navGroups = filterNavGroups(sidebarData.navGroups, user.role);

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false);
      command();
    },
    [setOpen],
  );

  return (
    <CommandDialog modal onOpenChange={setOpen} open={open}>
      <CommandInput placeholder={t("common.searchPlaceholder")} />
      <CommandList>
        <ScrollArea className="h-72 pe-1">
          <CommandEmpty>{t("common.noResults")}</CommandEmpty>
          {navGroups.map((group) => (
            <CommandGroup heading={t(group.title)} key={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url) {
                  const disabled = Boolean(navItem.disabled);
                  const requiredRole =
                    disabled && navItem.permission
                      ? getMinimumRoleForPermission(
                          navItem.permission.resource,
                          navItem.permission.action,
                        )
                      : null;
                  const label = requiredRole
                    ? `${t(navItem.title)} — ${t("dashboard.nav.permissionRequired", {
                        role: t(`dashboard.roles.${requiredRole}`),
                      })}`
                    : t(navItem.title);

                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      disabled={disabled}
                      onSelect={() => {
                        if (disabled) return;
                        runCommand(() => navigate({ to: navItem.url }));
                      }}
                      value={label}
                    >
                      <div className="flex size-4 items-center justify-center">
                        <ArrowRight className="size-2 text-muted-foreground/80" />
                      </div>
                      {t(navItem.title)}
                    </CommandItem>
                  );
                }

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }));
                    }}
                    value={`${t(navItem.title)} ${t(subItem.title)}`}
                  >
                    <div className="flex size-4 items-center justify-center">
                      <ArrowRight className="size-2 text-muted-foreground/80" />
                    </div>
                    {t(navItem.title)} <ChevronRight /> {t(subItem.title)}
                  </CommandItem>
                ));
              })}
            </CommandGroup>
          ))}
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  );
}
