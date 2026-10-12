import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { openSignInDialog } from "@/components/auth/sign-in-dialog";

export const Route = createFileRoute("/(auth)/auth/_unauthed/sign-in")({
  component: SignInRoute,
});

function SignInRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    openSignInDialog();
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  return null;
}
