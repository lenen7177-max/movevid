import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth/auth-server";

export const Route = createFileRoute("/billing")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/auth/sign-in" });
    }
    return { user };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
