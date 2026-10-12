import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@repo/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { useTranslations } from "@/i18n";
import { getMinimumRoleForPermission } from "@/lib/rbac";
import { Badge } from "@repo/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import type { NavCollapsible, NavGroup as NavGroupProps, NavItem, NavLink } from "./types";

const getTranslationKey = (title: string) => {
  const map: Record<string, string> = {
    General: "dashboard.nav.general",
    Dashboard: "dashboard.nav.dashboard",
    Users: "dashboard.nav.users",
    Other: "dashboard.nav.other",
    Settings: "dashboard.nav.settings",
    Profile: "dashboard.nav.profile",
    Account: "dashboard.nav.account",
    Appearance: "dashboard.nav.appearance",
    Notifications: "dashboard.nav.notifications",
    Display: "dashboard.nav.display",
  };
  return map[title] || title;
};

export function NavGroup({ title, items }: NavGroupProps) {
  const t = useTranslations();
  const { state, isMobile } = useSidebar();
  const href = useLocation({ select: (location) => location.href });
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(getTranslationKey(title))}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url}`;

          if (!item.items) {
            return <SidebarMenuLink href={href} item={item} key={key} />;
          }

          if (state === "collapsed" && !isMobile) {
            return <SidebarMenuCollapsedDropdown href={href} item={item} key={key} />;
          }

          return <SidebarMenuCollapsible href={href} item={item} key={key} />;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className="rounded-full px-1 py-0 text-xs">{children}</Badge>;
}

function usePermissionTooltip(item: NavLink): string | null {
  const t = useTranslations();
  if (!item.disabled || !item.permission) return null;
  const requiredRole = getMinimumRoleForPermission(
    item.permission.resource,
    item.permission.action,
  );
  if (!requiredRole) return null;
  return t("dashboard.nav.permissionRequiredDescription", {
    role: t(`dashboard.roles.${requiredRole}`),
  });
}

function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const t = useTranslations();
  const { setOpenMobile } = useSidebar();
  const permissionTooltip = usePermissionTooltip(item);
  const label = t(getTranslationKey(item.title));

  if (item.disabled) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger render={<span className="flex w-full" />}>
            <SidebarMenuButton disabled className="pointer-events-none w-full opacity-50">
              {item.icon && <item.icon />}
              <span>{label}</span>
              {item.badge && <NavBadge>{item.badge}</NavBadge>}
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">{permissionTooltip ?? label}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link onClick={() => setOpenMobile(false)} to={item.url} />}
        isActive={checkIsActive(href, item)}
        tooltip={label}
      >
        {item.icon && <item.icon />}
        <span>{label}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarMenuCollapsible({ item, href }: { item: NavCollapsible; href: string }) {
  const t = useTranslations();
  const { setOpenMobile } = useSidebar();
  return (
    <Collapsible
      render={<SidebarMenuItem />}
      className="group/collapsible"
      defaultOpen={item.defaultOpen || checkIsActive(href, item, true)}
    >
      <CollapsibleTrigger
        className="group"
        render={<SidebarMenuButton tooltip={t(getTranslationKey(item.title))} />}
      >
        {item.icon && <item.icon />}
        <span>{t(getTranslationKey(item.title))}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
        <ChevronRight className="ms-auto transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none rtl:rotate-180 rtl:group-data-panel-open:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
        <SidebarMenuSub>
          {item.items.map((subItem) => (
            <SidebarMenuSubItem key={subItem.title}>
              <SidebarMenuSubButton
                render={<Link onClick={() => setOpenMobile(false)} to={subItem.url} />}
                isActive={checkIsActive(href, subItem)}
              >
                {subItem.icon && <subItem.icon />}
                <span>{t(getTranslationKey(subItem.title))}</span>
                {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarMenuCollapsedDropdown({ item, href }: { item: NavCollapsible; href: string }) {
  const t = useTranslations();
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              isActive={checkIsActive(href, item)}
              tooltip={t(getTranslationKey(item.title))}
            />
          }
        >
          {item.icon && <item.icon />}
          <span>{t(getTranslationKey(item.title))}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
          <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t(getTranslationKey(item.title))} {item.badge ? `(${item.badge})` : ""}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {item.items.map((sub) => (
              <DropdownMenuItem
                key={`${sub.title}-${sub.url}`}
                render={
                  <Link
                    className={`${checkIsActive(href, sub) ? "bg-secondary" : ""}`}
                    to={sub.url}
                  />
                }
              >
                {sub.icon && <sub.icon />}
                <span className="max-w-52 text-wrap">{t(getTranslationKey(sub.title))}</span>
                {sub.badge && <span className="ms-auto text-xs">{sub.badge}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function checkIsActive(href: string, item: NavItem, mainNav = false) {
  return (
    href === item.url || // /endpint?search=param
    href.split("?")[0] === item.url || // endpoint
    !!item?.items?.filter((i) => i.url === href).length || // if child nav is active
    (mainNav && href.split("/")[1] !== "" && href.split("/")[1] === item?.url?.split("/")[1])
  );
}
