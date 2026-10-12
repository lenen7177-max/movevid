import { createFileRoute, redirect } from "@tanstack/react-router";
import { ForgotPasswordForm } from "@/components/auth/email/forgot-password-form";
import { webConfig } from "@/configs/web-config";

export const Route = createFileRoute("/(auth)/auth/_unauthed/forgot-password")({
  beforeLoad: () => {
    if (!webConfig.auth.methods.emailPasswordEnabled) {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: ForgotPasswordForm,
});
