import { rbacConfig, type AppRole } from "@repo/app-config/rbac";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, lte, or } from "drizzle-orm";
import type { Database } from "@/db";
import { user } from "@/db/schema/auth";

export const managedUserSelectFields = {
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  phoneNumber: user.phoneNumber,
  phoneNumberVerified: user.phoneNumberVerified,
  image: user.image,
  role: user.role,
  banned: user.banned,
  banReason: user.banReason,
  banExpires: user.banExpires,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
} as const;

type ListManagedUsersInput = {
  page: number;
  perPage: number;
  name?: string | undefined;
  role?: AppRole[] | undefined;
  sort: Array<{ id: "name" | "email" | "createdAt"; desc: boolean }>;
};

export async function listManagedUsers(db: Database, input: ListManagedUsersInput) {
  const conditions = [isNull(user.deletedAt)];
  const searchTerm = input.name?.trim();

  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    conditions.push(like(user.name, pattern));
  }
  if (input.role?.length) {
    conditions.push(inArray(user.role, input.role));
  }

  const whereClause = and(...conditions);
  const sortableColumns = {
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  } as const;
  const orderBy =
    input.sort.length > 0
      ? input.sort.map((item) => {
          const column = sortableColumns[item.id];
          return item.desc ? desc(column) : asc(column);
        })
      : [desc(user.createdAt)];

  const [items, countResult] = await Promise.all([
    db
      .select(managedUserSelectFields)
      .from(user)
      .where(whereClause)
      .orderBy(...orderBy, asc(user.id))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage),
    db.select({ count: count() }).from(user).where(whereClause),
  ]);
  const total = countResult.at(0)?.count ?? 0;

  return {
    items,
    pageCount: Math.ceil(total / input.perPage),
    total,
  };
}

export async function findManagedUser(db: Database, userId: string) {
  const [managedUser] = await db
    .select(managedUserSelectFields)
    .from(user)
    .where(and(eq(user.id, userId), isNull(user.deletedAt)));

  return managedUser;
}

export async function countActiveAdministrators(db: Database): Promise<number> {
  const now = new Date();
  const [result] = await db
    .select({ count: count() })
    .from(user)
    .where(
      and(
        inArray(user.role, [...rbacConfig.adminRoles]),
        isNull(user.deletedAt),
        or(
          eq(user.banned, false),
          isNull(user.banned),
          and(eq(user.banned, true), isNotNull(user.banExpires), lte(user.banExpires, now)),
        ),
      ),
    );

  return result?.count ?? 0;
}
