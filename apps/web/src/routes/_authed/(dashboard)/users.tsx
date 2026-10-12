import { hasPermission } from "@repo/app-config/rbac";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { UsersTableContainer } from "@/components/dashboard/users";
import { ContentLoading } from "@/components/feedback/full-screen-loading";
import { webConfig } from "@/configs/web-config";

const searchSchema = z.object({
  page: z.number().optional().default(0),
  size: z.number().optional().default(10),
  search: z.string().optional().default(""),
  sort: z.string().optional().default("createdAt:desc"),
  role: z
    .array(z.enum(["user", "admin"]))
    .optional()
    .default([]),
});

export const Route = createFileRoute("/_authed/(dashboard)/users")({
  beforeLoad: ({ context }) => {
    if (!webConfig.adminUserManagementEnabled) {
      throw notFound();
    }
    if (!hasPermission(context.user.role, "user", "list")) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: UsersTableContainer,
  pendingComponent: ContentLoading,
  validateSearch: searchSchema,
});
