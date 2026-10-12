import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@repo/ui/button";

export const Route = createFileRoute("/(auth)/auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="relative flex h-screen flex-1 p-4">
      <Link className="absolute top-4 left-4" to="/">
        <Button variant="outline">
          <IconArrowLeft />
        </Button>
      </Link>
      <main className="flex w-full grow flex-col items-center justify-start gap-4 overflow-y-auto p-4 pt-16 md:justify-center md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
