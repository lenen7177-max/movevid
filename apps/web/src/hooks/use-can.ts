import { hasPermission, type RbacAction, type RbacResource } from "@repo/app-config/rbac";
import { Route } from "@/routes/_authed/(dashboard)/route";

export function useDashboardUser() {
  const { user } = Route.useRouteContext();
  return user;
}

export function useCan<R extends RbacResource>(resource: R, action: RbacAction<R>): boolean {
  const user = useDashboardUser();
  return hasPermission(user.role, resource, action);
}
