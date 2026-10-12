import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthenticatedLayout } from "@/components/dashboard/authed-layout";
import { getCurrentUser } from "@/lib/auth/auth-server";

export const Route = createFileRoute("/_authed/(dashboard)")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/auth/sign-in" });
    }
    return { user };
  },
  component: AuthenticatedLayout,
});
