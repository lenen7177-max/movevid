import { describe, expect, it } from "vitest";
import {
  assertRolePermissionMatrix,
  hasPermission,
  normalizeRbacConfig,
  resolveRole,
} from "../rbac";
import type { RbacConfig } from "../types";

describe("rbac", () => {
  it("grants declared permissions for each role", () => {
    expect(hasPermission("user", "user", "list")).toBe(false);
    expect(hasPermission("user", "admin", "access")).toBe(false);

    expect(hasPermission("admin", "user", "list")).toBe(true);
    expect(hasPermission("admin", "user", "set-role")).toBe(true);
    expect(hasPermission("admin", "user", "ban")).toBe(true);
    expect(hasPermission("admin", "admin", "access")).toBe(true);
  });

  it("denies unknown roles without throwing", () => {
    expect(resolveRole("moderator")).toBeNull();
    expect(hasPermission("moderator", "user", "list")).toBe(false);
    expect(hasPermission(null, "admin", "access")).toBe(false);
    expect(hasPermission(undefined, "user", "list")).toBe(false);
  });

  it("denies comma-separated role values instead of unioning them", () => {
    expect(resolveRole("admin,user")).toBeNull();
    expect(hasPermission("admin,user", "user", "list")).toBe(false);
    expect(hasPermission("admin,user", "admin", "access")).toBe(false);
  });

  it("normalizes a valid rbac config", () => {
    const input: RbacConfig = {
      defaultRole: "user",
      adminRoles: ["admin"],
    };

    expect(normalizeRbacConfig(input)).toEqual({
      defaultRole: "user",
      adminRoles: ["admin"],
    });
  });

  it("throws for an unknown defaultRole", () => {
    expect(() =>
      normalizeRbacConfig({
        defaultRole: "superadmin" as RbacConfig["defaultRole"],
        adminRoles: ["admin"],
      }),
    ).toThrow("[rbac] Unknown defaultRole: superadmin");
  });

  it("throws for an unknown adminRoles entry", () => {
    expect(() =>
      normalizeRbacConfig({
        defaultRole: "user",
        adminRoles: ["owner" as RbacConfig["adminRoles"][number]],
      }),
    ).toThrow("[rbac] Unknown adminRoles entry: owner");
  });

  it("throws when the matrix grants an undeclared action or resource", () => {
    expect(() =>
      assertRolePermissionMatrix({
        admin: { user: ["list", "delete"] },
      }),
    ).toThrow("[rbac] Role admin grants undeclared action delete on resource user");

    expect(() =>
      assertRolePermissionMatrix({
        admin: { billing: ["access"] },
      }),
    ).toThrow("[rbac] Role admin grants unknown resource: billing");
  });
});
