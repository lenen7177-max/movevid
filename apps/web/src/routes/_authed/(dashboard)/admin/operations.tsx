import { hasPermission } from "@repo/app-config/rbac";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AdminOperationsTableContainer } from "@/components/dashboard/admin-operations";
import { webConfig } from "@/configs/web-config";

const searchSchema = z.object({
  page: z.number().optional().default(0),
  size: z.number().optional().default(20),
  search: z.string().optional().default(""),
  action: z
    .array(z.enum(["credits.adjust", "membership.grant_trial"]))
    .optional()
    .default([]),
  status: z
    .array(z.enum(["pending", "succeeded", "failed"]))
    .optional()
    .default([]),
});

export const Route = createFileRoute("/_authed/(dashboard)/admin/operations")({
  beforeLoad: ({ context }) => {
    if (!webConfig.adminUserManagementEnabled) throw notFound();
    if (!hasPermission(context.user.role, "operation", "list")) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: AdminOperationsTableContainer,
  validateSearch: searchSchema,
});
