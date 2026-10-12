import type { RbacAction, RbacResource } from "@repo/app-config/rbac";
import type { LinkProps } from "@tanstack/react-router";

type User = {
  name: string;
  email: string;
  avatar: string;
};

type NavPermission = {
  [R in RbacResource]: { resource: R; action: RbacAction<R> };
}[RbacResource];

type BaseNavItem = {
  title: string;
  badge?: string;
  icon?: React.ElementType;
};

type NavLink = BaseNavItem & {
  url: LinkProps["to"] | (string & {});
  items?: never;
  permission?: NavPermission;
  /** Set by `filterNavGroups` in development when the account lacks permission. */
  disabled?: boolean;
};

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & {
    url: LinkProps["to"] | (string & {});
    permission?: NavPermission;
  })[];
  defaultOpen?: boolean;
  url?: never;
};

type NavItem = NavCollapsible | NavLink;

type NavGroup = {
  title: string;
  items: NavItem[];
};

type SidebarData = {
  user: User;
  navGroups: NavGroup[];
};

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink, NavPermission };
