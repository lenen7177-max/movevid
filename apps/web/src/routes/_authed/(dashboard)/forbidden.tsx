import { createFileRoute } from "@tanstack/react-router";
import { Forbidden403 } from "@/components/feedback/403/forbidden-403";
import { ContentLoading } from "@/components/feedback/full-screen-loading";

export const Route = createFileRoute("/_authed/(dashboard)/forbidden")({
  component: Forbidden403,
  pendingComponent: ContentLoading,
});
