import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignupForm } from "@/components/auth/email/sign-up-form";
import { webConfig } from "@/configs/web-config";

export const Route = createFileRoute("/(auth)/auth/_unauthed/sign-up")({
  beforeLoad: () => {
    if (!webConfig.auth.methods.emailPasswordEnabled) {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: SignupForm,
});
