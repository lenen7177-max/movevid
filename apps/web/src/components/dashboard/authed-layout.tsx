import { Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
// import { SkipToMain } from "@/components/dashboard/skip-to-main";
import { LayoutProvider } from "@/components/providers/layout-provider";
import { SearchProvider } from "@/components/providers/search-provider";
import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import { Route } from "@/routes/_authed/(dashboard)/route";
import { Container } from "./container";
import { SiteHeader } from "./site-header";

type AuthenticatedLayoutProps = {
  children?: React.ReactNode;
};

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie("sidebar_state") !== "false";
  const { user } = Route.useRouteContext();
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen} className="h-svh min-h-0 overflow-hidden">
          {/* <SkipToMain /> */}
          <AppSidebar user={user} />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              "@container/content",

              // Keep page scrolling inside the content area below the header.
              "min-h-0 overflow-hidden",
            )}
          >
            <SiteHeader />
            <Container>{children ?? <Outlet />}</Container>
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  );
}
