import { hasPermission, type RbacAction, type RbacResource } from "@repo/app-config/rbac";
import { ORPCError, os } from "@orpc/server";
import { eq } from "drizzle-orm";
import { user } from "@/db/schema/auth";
import { isActivelyBanned } from "./auth-session-guard";
import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

export type AuthUserSnapshot = {
  deletedAt: Date | null;
  role: string | null;
  banned: boolean | null;
  banExpires: Date | null;
};

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const [currentUser] = await context.db
    .select({
      id: user.id,
      deletedAt: user.deletedAt,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, context.session.user.id));

  if (currentUser?.deletedAt) {
    throw new ORPCError("UNAUTHORIZED");
  }

  if (currentUser && isActivelyBanned(currentUser)) {
    throw new ORPCError("FORBIDDEN", {
      message: context.t("errors.accountBanned"),
      data: { reason: "ACCOUNT_BANNED" },
    });
  }

  return next({
    context: {
      currentUser: currentUser ?? {
        deletedAt: null,
        role: null,
        banned: false,
        banExpires: null,
      },
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export function assertPermission<R extends RbacResource>(
  context: Context & { currentUser?: AuthUserSnapshot },
  resource: R,
  action: RbacAction<R>,
): void {
  if (!hasPermission(context.currentUser?.role, resource, action)) {
    throw new ORPCError("FORBIDDEN", {
      message: context.t("errors.forbidden"),
    });
  }
}

export function requirePermission<R extends RbacResource>(resource: R, action: RbacAction<R>) {
  return o.middleware(async ({ context, next }) => {
    assertPermission(context, resource, action);
    return next();
  });
}

export const adminProcedure = protectedProcedure.use(requirePermission("admin", "access"));
