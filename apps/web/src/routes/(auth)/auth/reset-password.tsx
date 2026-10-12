import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ResetPasswordForm } from "@/components/auth/email/reset-password-form";
import { webConfig } from "@/configs/web-config";
import { getCurrentUser } from "@/lib/auth/auth-server";

const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/(auth)/auth/reset-password")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (!webConfig.auth.methods.emailPasswordEnabled) {
      throw redirect({ to: "/auth/sign-in" });
    }

    // Logged-in users may stay only when they arrived via the reset email (token or error in the URL).
    if (search.token || search.error) return;
    const user = await getCurrentUser();
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: ResetPasswordForm,
});
