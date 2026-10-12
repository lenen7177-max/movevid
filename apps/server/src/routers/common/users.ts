import { env } from "cloudflare:workers";
import { ORPCError } from "@orpc/server";
import { resolveCommonConfig } from "@repo/app-config";
import { APP_ROLES, isAdminRole, rbacConfig } from "@repo/app-config/rbac";
import { getVisibleUserName } from "@repo/shared";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  AbuseBlockError,
  blockManagedUserIdentifier,
  listLatestSignupGrantClaims,
} from "@/abuse/admin";
import { recordUserAcquisition } from "@/analytics/acquisition";
import { ABUSE_BLOCKLIST_KINDS } from "@/db/schema/abuse";
import { account, session, user } from "@/db/schema/auth";
import { revokeRemainingSignupCredits } from "@/credits";
import type { Context } from "@/lib/context";
import { buildDeletedAccountUserUpdate, isActivelyBanned } from "@/lib/auth-session-guard";
import { assertPermission, protectedProcedure, publicProcedure } from "@/lib/orpc";
import { getAdminApi } from "@/lib/rbac";
import {
  countActiveAdministrators,
  findManagedUser,
  listManagedUsers,
  managedUserSelectFields,
} from "@/lib/user-management";
import {
  getStorageProvider,
  getStoragePublicBaseUrl,
  getUserStoragePrefix,
  parseStoragePublicUrl,
} from "@/storage";

const appRoleSchema = z.enum(APP_ROLES);
const userManagementEnabled = resolveCommonConfig().admin.userManagement.enabled;

// Input schemas
const listUsersInputSchema = z.object({
  page: z.number().min(1).default(1),
  perPage: z.number().min(1).max(100).default(10),
  name: z.string().optional(),
  role: z.array(appRoleSchema).optional(),
  sort: z
    .array(
      z.object({
        id: z.enum(["name", "email", "createdAt"]),
        desc: z.boolean(),
      }),
    )
    .optional()
    .default([{ id: "createdAt", desc: true }]),
});

// Output schemas
const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable(),
  banExpires: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  signupGrant: z
    .object({
      status: z.enum(["granted", "blocked"]),
      reason: z.string(),
    })
    .nullable(),
});

const listUsersOutputSchema = z.object({
  data: z.array(userSchema),
  pageCount: z.number(),
  total: z.number(),
});

type UserListItem = z.infer<typeof userSchema>;

function normalizeUserForOutput(
  userItem: Omit<UserListItem, "signupGrant">,
): Omit<UserListItem, "signupGrant"> {
  return {
    ...userItem,
    name: getVisibleUserName(userItem),
  };
}

async function withSignupGrants<T extends { id: string }>(
  db: Context["db"],
  users: T[],
): Promise<Array<T & Pick<UserListItem, "signupGrant">>> {
  const claims = await listLatestSignupGrantClaims(
    db,
    users.map((item) => item.id),
  );
  return users.map((item) => ({
    ...item,
    signupGrant: claims.get(item.id) ?? null,
  }));
}

async function withSignupGrant<T extends { id: string }>(db: Context["db"], managedUser: T) {
  const [item] = await withSignupGrants(db, [managedUser]);
  return item ?? { ...managedUser, signupGrant: null };
}

async function requireManagedUser(context: Context, userId: string) {
  const managedUser = await findManagedUser(context.db, userId);
  if (!managedUser) {
    throw new ORPCError("NOT_FOUND", {
      message: context.t("errors.notFound"),
    });
  }
  return managedUser;
}

function assertUserManagementEnabled(): void {
  if (!userManagementEnabled) {
    throw new ORPCError("NOT_FOUND");
  }
}

const acquisitionText = (max: number) => z.string().trim().min(1).max(max).optional();

const recordAcquisitionInputSchema = z.object({
  referrerHost: acquisitionText(255),
  utmSource: acquisitionText(120),
  utmMedium: acquisitionText(120),
  utmCampaign: acquisitionText(120),
  landingPath: acquisitionText(300),
  firstSeenAt: z.number().int().positive().optional(),
});

export const usersRouter = {
  getCurrentUser: publicProcedure.handler(({ context }) => getCurrentUserFromContext(context)),
  /**
   * Stores where the signed-in user first came from (first visit in this browser). Only the first
   * call per user counts, so later visits from other sources never overwrite it.
   */
  recordAcquisition: protectedProcedure
    .input(recordAcquisitionInputSchema)
    .output(z.object({ recorded: z.boolean() }))
    .handler(async ({ context, input }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", { message: context.t("errors.unauthorized") });
      }
      return { recorded: await recordUserAcquisition(context.db, userId, input) };
    }),
  getPasswordStatus: protectedProcedure
    .output(
      z.object({
        hasPassword: z.boolean(),
        socialProviders: z.array(z.enum(["github", "google"])).optional(),
      }),
    )
    .handler(async ({ context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: context.t("errors.unauthorized"),
        });
      }

      // Optimized query: only select necessary fields and use conditional logic
      const accounts = await context.db
        .select({
          providerId: account.providerId,
          hasPassword: isNotNull(account.password),
        })
        .from(account)
        .where(eq(account.userId, userId));

      // Extract social providers (non-credential accounts)
      const socialProviders = accounts
        .filter((acc) => acc.providerId !== "credential")
        .map((acc) => acc.providerId)
        .filter(
          (provider): provider is "github" | "google" =>
            provider === "github" || provider === "google",
        );

      // Check if user has password (any credential account with password)
      const hasPassword = accounts.some(
        (acc) => acc.providerId === "credential" && acc.hasPassword,
      );

      return {
        hasPassword,
        socialProviders: socialProviders.length > 0 ? socialProviders : undefined,
      };
    }),

  list: protectedProcedure
    .input(listUsersInputSchema)
    .output(listUsersOutputSchema)
    .handler(async ({ context, input }) => {
      assertUserManagementEnabled();
      assertPermission(context, "user", "list");
      const result = await listManagedUsers(context.db, input);

      return {
        data: await withSignupGrants(context.db, result.items.map(normalizeUserForOutput)),
        pageCount: result.pageCount,
        total: result.total,
      };
    }),

  setRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        role: appRoleSchema,
      }),
    )
    .output(userSchema)
    .handler(async ({ context, input }) => {
      assertUserManagementEnabled();
      assertPermission(context, "user", "set-role");

      const callerId = context.session!.user.id;
      const target = await requireManagedUser(context, input.userId);
      const targetIsAdmin = isAdminRole(target.role, rbacConfig.adminRoles);
      const nextIsAdmin = isAdminRole(input.role, rbacConfig.adminRoles);

      if (target.id === callerId && targetIsAdmin && !nextIsAdmin) {
        const adminCount = await countActiveAdministrators(context.db);
        if (adminCount <= 1) {
          throw new ORPCError("BAD_REQUEST", {
            message: context.t("errors.cannotDemoteLastAdmin"),
          });
        }
      }

      await getAdminApi(context.auth).setRole({
        body: { userId: input.userId, role: input.role },
        headers: context.headers,
      });

      return withSignupGrant(
        context.db,
        normalizeUserForOutput(await requireManagedUser(context, input.userId)),
      );
    }),

  ban: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        banReason: z.string().max(500).optional(),
        banExpiresIn: z.number().int().positive().optional(),
        revokeSignupCredits: z.boolean().optional(),
      }),
    )
    .output(userSchema)
    .handler(async ({ context, input }) => {
      assertUserManagementEnabled();
      assertPermission(context, "user", "ban");

      if (input.userId === context.session!.user.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: context.t("errors.cannotBanSelf"),
        });
      }

      await requireManagedUser(context, input.userId);
      if (input.revokeSignupCredits) {
        await revokeRemainingSignupCredits(context.db, {
          userId: input.userId,
          idempotencyKey: `ban-signup-revoke:${input.userId}:${crypto.randomUUID()}`,
        });
      }
      await getAdminApi(context.auth).banUser({
        body: {
          userId: input.userId,
          banReason: input.banReason,
          banExpiresIn: input.banExpiresIn,
        },
        headers: context.headers,
      });

      return withSignupGrant(
        context.db,
        normalizeUserForOutput(await requireManagedUser(context, input.userId)),
      );
    }),

  blockIdentifier: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        kind: z.enum(ABUSE_BLOCKLIST_KINDS),
      }),
    )
    .output(z.object({ kind: z.enum(ABUSE_BLOCKLIST_KINDS), value: z.string() }))
    .handler(async ({ context, input }) => {
      assertUserManagementEnabled();
      assertPermission(context, "user", "ban");

      if (input.userId === context.session!.user.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: context.t("errors.cannotBlockSelf"),
        });
      }

      const target = await requireManagedUser(context, input.userId);
      try {
        return await blockManagedUserIdentifier(context.db, {
          userId: target.id,
          email: target.email,
          kind: input.kind,
          createdBy: context.session!.user.id,
        });
      } catch (error) {
        if (!(error instanceof AbuseBlockError)) throw error;
        const messageKey = {
          phone_domain: "errors.phoneDomainUnavailable",
          missing_ip: "errors.noClientIp",
          missing_device: "errors.noClientDevice",
          invalid_domain: "errors.invalidEmailDomain",
        }[error.code];
        throw new ORPCError("BAD_REQUEST", { message: context.t(messageKey) });
      }
    }),

  unban: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .output(userSchema)
    .handler(async ({ context, input }) => {
      assertUserManagementEnabled();
      assertPermission(context, "user", "ban");

      await requireManagedUser(context, input.userId);
      await getAdminApi(context.auth).unbanUser({
        body: { userId: input.userId },
        headers: context.headers,
      });

      return withSignupGrant(
        context.db,
        normalizeUserForOutput(await requireManagedUser(context, input.userId)),
      );
    }),

  deleteAccount: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: context.t("errors.unauthorized"),
        });
      }
      const db = context.db;
      const deletedAt = new Date();
      const [currentUser] = await db
        .select({
          email: user.email,
        })
        .from(user)
        .where(eq(user.id, userId));

      if (!currentUser) {
        throw new ORPCError("NOT_FOUND", {
          message: context.t("errors.notFound"),
        });
      }

      await db
        .update(user)
        .set(buildDeletedAccountUserUpdate(currentUser, deletedAt))
        .where(eq(user.id, userId));
      await db.delete(session).where(eq(session.userId, userId));
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        image: z.string().max(500).optional().nullable(),
      }),
    )
    .output(userSchema)
    .handler(async ({ context, input }) => {
      const { db, t } = context;
      const userId = context.session?.user.id;

      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: t("errors.unauthorized"),
        });
      }

      // If updating avatar, delete the old one first
      if (input.image !== undefined) {
        const [currentUser] = await db
          .select({ image: user.image })
          .from(user)
          .where(eq(user.id, userId));

        if (currentUser?.image) {
          const publicBaseUrl = getStoragePublicBaseUrl(env.SERVER_URL);
          const parsedStorageUrl = parseStoragePublicUrl(publicBaseUrl, currentUser.image);
          if (parsedStorageUrl?.key.startsWith(getUserStoragePrefix("avatar", userId))) {
            const storageProvider = getStorageProvider({
              storage: env.STORAGE,
              provider: parsedStorageUrl.provider,
              aliyunOssEnv: env,
            });
            await storageProvider.delete(parsedStorageUrl.key).catch(() => {
              // Ignore errors if file doesn't exist
            });
          }
        }
      }

      const [updatedUser] = await db
        .update(user)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId))
        .returning();

      if (!updatedUser) {
        throw new ORPCError("NOT_FOUND", {
          message: t("errors.notFound"),
        });
      }

      return withSignupGrant(
        db,
        normalizeUserForOutput({
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified,
          phoneNumber: updatedUser.phoneNumber,
          phoneNumberVerified: updatedUser.phoneNumberVerified,
          image: updatedUser.image,
          role: updatedUser.role,
          banned: updatedUser.banned,
          banReason: updatedUser.banReason,
          banExpires: updatedUser.banExpires,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        }),
      );
    }),
};

export async function getCurrentUserFromContext(context: Context) {
  const sessionUser = context.session?.user;
  if (!sessionUser) return null;

  const [currentUser] = await context.db
    .select(managedUserSelectFields)
    .from(user)
    .where(and(eq(user.id, sessionUser.id), isNull(user.deletedAt)));

  if (!currentUser) return null;

  if (isActivelyBanned(currentUser)) {
    return null;
  }

  return normalizeUserForOutput(currentUser);
}
