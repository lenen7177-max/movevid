import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const Route = createFileRoute("/_public")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="relative min-h-screen w-full overflow-x-clip">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  );
}
