import {
  APP_ROLES,
  hasPermission,
  type AppRole,
  type RbacAction,
  type RbacResource,
} from "@repo/app-config/rbac";
import type { NavGroup, NavItem, NavPermission } from "@/components/dashboard/types";

/** Lowest declared role that grants the given permission. */
export function getMinimumRoleForPermission<R extends RbacResource>(
  resource: R,
  action: RbacAction<R>,
): AppRole | null {
  for (const role of APP_ROLES) {
    if (hasPermission(role, resource, action)) {
      return role;
    }
  }
  return null;
}

function filterNavItem(item: NavItem, role: string | null | undefined): NavItem | null {
  if (item.items) {
    const items = item.items.filter((sub) => {
      const permission =
        "permission" in sub ? (sub.permission as NavPermission | undefined) : undefined;
      if (!permission) return true;
      return hasPermission(role, permission.resource, permission.action);
    });
    if (items.length === 0) return null;
    return { ...item, items };
  }

  if (!item.permission) {
    return item;
  }

  const allowed = hasPermission(role, item.permission.resource, item.permission.action);
  if (allowed) {
    return { ...item, disabled: false };
  }

  if (import.meta.env.DEV) {
    return { ...item, disabled: true };
  }

  return null;
}

/**
 * Drop nav entries the role cannot use (and empty groups).
 * In development, denied permission-gated entries are kept as `disabled`.
 */
export function filterNavGroups(groups: NavGroup[], role: string | null | undefined): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => filterNavItem(item, role))
        .filter((item): item is NavItem => item != null),
    }))
    .filter((group) => group.items.length > 0);
}
