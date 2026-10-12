import { resolveCommonConfig } from "../app-config";
import { APP_ROLES, type AppRole, type RbacConfig } from "../types";

export { APP_ROLES, type AppRole, type RbacConfig } from "../types";

/**
 * Application permission vocabulary.
 *
 * `RBAC_STATEMENTS` declares which resource/action pairs exist. It is the
 * permission dictionary and type source; declaring a pair here does not grant
 * it to any role.
 *
 * ```text
 * RBAC_STATEMENTS                    Valid permission pairs
 * ├── admin: [access]                → admin:access
 * ├── user: [list, set-role, ban]    → user:list
 * │                                  → user:set-role
 * │                                  → user:ban
 * ├── credits: [adjust]              → credits:adjust
 * ├── membership: [grant-trial]      → membership:grant-trial
 * └── operation: [list]              → operation:list
 *
 * resource: [supported actions]
 * ```
 *
 * Resource and action names under `user` deliberately mirror Better Auth's
 * `defaultStatements.user` so one matrix can drive both our procedures and the
 * plugin's own authorization checks. The plugin's HTTP admin routes are closed
 * separately; sharing the vocabulary is still useful for server-side `auth.api`.
 */
export const RBAC_STATEMENTS = {
  user: ["list", "set-role", "ban"],
  // Project-owned: whether the account may enter administrative surfaces at all.
  admin: ["access"],
  credits: ["adjust"],
  membership: ["grant-trial"],
  operation: ["list"],
} as const;

export type RbacResource = keyof typeof RBAC_STATEMENTS;
export type RbacAction<R extends RbacResource = RbacResource> = (typeof RBAC_STATEMENTS)[R][number];

type RolePermissionGrants = {
  readonly [R in RbacResource]?: readonly RbacAction<R>[];
};

/**
 * Static role → permission matrix.
 *
 * `ROLE_PERMISSIONS` assigns declared permission pairs to roles. Every
 * resource/action listed here must already exist in `RBAC_STATEMENTS`.
 *
 * ```text
 * RBAC_STATEMENTS                    ROLE_PERMISSIONS
 * (what permissions exist)          (which roles receive them)
 *          │                                    │
 *          └──── validates each grant ──────────┘
 *                                               │
 *                                               ▼
 * ROLE_PERMISSIONS
 * ├── user                         ← role
 * │   └── {}                       ← no administrative grants
 * └── admin                        ← role
 *     ├── admin                    ← resource
 *     │   └── access               ← action
 *     ├── user                     ← resource (user management, not the user role)
 *     │   ├── list                 ← action
 *     │   ├── set-role             ← action
 *     │   └── ban                  ← action
 *     ├── credits
 *     │   └── adjust
 *     ├── membership
 *     │   └── grant-trial
 *     └── operation
 *         └── list
 *
 * hasPermission("admin", "credits", "adjust")
 *               └─ role  └─ resource └─ action
 *
 * 1. `credits:adjust` must be declared in RBAC_STATEMENTS.
 * 2. `admin` must receive `credits:adjust` in ROLE_PERMISSIONS.
 * 3. Only then does hasPermission(...) return true.
 * ```
 *
 * Single-role constraint: each account stores exactly one AppRole. Better Auth
 * tolerates comma-separated values in the column, but this evaluator does not.
 * To lift the constraint, change `resolveRole` and every query site that
 * compares `user.role` for equality (notably `users.list` role filtering and
 * the last-administrator count in `users.setRole`).
 */
export const ROLE_PERMISSIONS: Record<AppRole, RolePermissionGrants> = {
  user: {},
  admin: {
    admin: ["access"],
    user: ["list", "set-role", "ban"],
    credits: ["adjust"],
    membership: ["grant-trial"],
    operation: ["list"],
  },
};

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Resolve a stored role column value to a declared AppRole.
 *
 * Only a single declared identifier is accepted. Comma-separated values and
 * unknown strings resolve to null (denied).
 */
export function resolveRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  return isAppRole(role) ? role : null;
}

export function hasPermission<R extends RbacResource>(
  role: string | null | undefined,
  resource: R,
  action: RbacAction<R>,
): boolean {
  const resolved = resolveRole(role);
  if (!resolved) return false;

  const grants = ROLE_PERMISSIONS[resolved][resource];
  if (!grants) return false;

  return (grants as readonly RbacAction<R>[]).includes(action);
}

export function isAdminRole(
  role: string | null | undefined,
  adminRoles: readonly AppRole[],
): boolean {
  const resolved = resolveRole(role);
  if (!resolved) return false;
  return adminRoles.includes(resolved);
}

type PermissionMatrix = Record<string, Record<string, readonly string[] | undefined>>;

/** Validate that every grant in a matrix is declared in RBAC_STATEMENTS. */
export function assertRolePermissionMatrix(matrix: PermissionMatrix): void {
  for (const [roleName, grants] of Object.entries(matrix)) {
    for (const [resource, actions] of Object.entries(grants)) {
      const declared = RBAC_STATEMENTS[resource as RbacResource];
      if (!declared) {
        throw new Error(`[rbac] Role ${roleName} grants unknown resource: ${resource}`);
      }

      for (const action of actions ?? []) {
        if (!(declared as readonly string[]).includes(action)) {
          throw new Error(
            `[rbac] Role ${roleName} grants undeclared action ${action} on resource ${resource}`,
          );
        }
      }
    }
  }
}

/**
 * Validate RBAC config and the static matrix.
 * Throws `[rbac] ...` errors matching the `[credits]` / `[membership]` style.
 */
export function normalizeRbacConfig(input: RbacConfig): RbacConfig {
  if (!isAppRole(input.defaultRole)) {
    throw new Error(`[rbac] Unknown defaultRole: ${String(input.defaultRole)}`);
  }

  if (!Array.isArray(input.adminRoles) || input.adminRoles.length === 0) {
    throw new Error("[rbac] adminRoles must be a non-empty array of declared roles.");
  }

  for (const role of input.adminRoles) {
    if (!isAppRole(role)) {
      throw new Error(`[rbac] Unknown adminRoles entry: ${String(role)}`);
    }
  }

  assertRolePermissionMatrix(ROLE_PERMISSIONS);

  return {
    defaultRole: input.defaultRole,
    adminRoles: [...input.adminRoles],
  };
}

export const rbacConfig: RbacConfig = normalizeRbacConfig(resolveCommonConfig().auth.rbac);
