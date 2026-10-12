import { RBAC_STATEMENTS } from "@repo/app-config/rbac";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Better Auth access-control adapter for the application role matrix.
 *
 * Product vocabulary lives in `@repo/app-config/rbac`. This module owns only
 * the plugin-facing Role objects and the statements the plugin's endpoints
 * understand. Dangerous statements (impersonate, delete, create, set-password)
 * remain in the AC vocabulary so the plugin can check for them, but no role
 * is granted them.
 *
 * The plugin's `/api/auth/admin/*` HTTP surface is closed in `index.ts`;
 * administration goes through oRPC procedures that call `auth.api.*` internally.
 */
const ac = createAccessControl({
  ...defaultStatements,
  ...RBAC_STATEMENTS,
  // Keep the full Better Auth user statement list so the plugin can still
  // authorize (and deny) its native endpoints. Spreading RBAC_STATEMENTS alone
  // would overwrite `user` with the shorter application list.
  user: [...new Set([...defaultStatements.user, ...RBAC_STATEMENTS.user])],
});

const userRole = ac.newRole({
  user: [],
  session: [],
  admin: [],
  credits: [],
  membership: [],
  operation: [],
});

const adminRole = ac.newRole({
  // Explicit grants only. Deliberately omitted:
  // create, delete, set-password, impersonate, impersonate-admins,
  // set-email, get, update, and all session:* statements.
  user: ["list", "set-role", "ban"],
  session: [],
  admin: ["access"],
  credits: ["adjust"],
  membership: ["grant-trial"],
  operation: ["list"],
});

export const betterAuthRoles = {
  user: userRole,
  admin: adminRole,
} as const;

export const betterAuthAccessControl = ac;

type AdminApi = {
  setRole: (args: {
    body: { userId: string; role: string | string[] };
    headers: Headers;
  }) => Promise<unknown>;
  banUser: (args: {
    body: { userId: string; banReason?: string; banExpiresIn?: number };
    headers: Headers;
  }) => Promise<unknown>;
  unbanUser: (args: { body: { userId: string }; headers: Headers }) => Promise<unknown>;
};

/**
 * Typed access to admin plugin API methods.
 *
 * `createAuth` is annotated with `BetterAuthOptions`, which erases plugin
 * endpoint inference. The methods exist at runtime once `admin()` is registered.
 */
export function getAdminApi(auth: { api: object }): AdminApi {
  return auth.api as AdminApi;
}
