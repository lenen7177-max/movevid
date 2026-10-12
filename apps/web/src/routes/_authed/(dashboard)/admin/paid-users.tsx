import { SUPPORTED_SERVER_PAYMENT_PROVIDERS } from "@repo/app-config";
import { hasPermission } from "@repo/app-config/rbac";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { PaidUsersTableContainer } from "@/components/dashboard/paid-users";
import { webConfig } from "@/configs/web-config";

const searchSchema = z.object({
  page: z.number().optional().default(0),
  size: z.number().optional().default(10),
  search: z.string().optional().default(""),
  sort: z.string().optional().default("latestBillingAt:desc"),
  state: z
    .array(z.enum(["paid", "trial", "ended"]))
    .optional()
    .default([]),
  tier: z
    .array(z.enum(["monthly", "yearly", "lifetime", "credits"]))
    .optional()
    .default([]),
  provider: z
    .array(z.enum([...SUPPORTED_SERVER_PAYMENT_PROVIDERS, "admin"]))
    .optional()
    .default([]),
});

export const Route = createFileRoute("/_authed/(dashboard)/admin/paid-users")({
  beforeLoad: ({ context }) => {
    // The shared config switch removes the feature entirely rather than only hiding navigation.
    if (!webConfig.adminPaidUsersEnabled) {
      throw notFound();
    }
    // Route authorization improves UX; adminProcedure independently protects the underlying data.
    if (!hasPermission(context.user.role, "admin", "access")) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: PaidUsersTableContainer,
  validateSearch: searchSchema,
});
