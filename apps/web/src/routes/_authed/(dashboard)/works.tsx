import { createFileRoute } from "@tanstack/react-router";
import { MyWorks } from "@/components/video/my-works";
import { ContentLoading } from "@/components/feedback/full-screen-loading";

export const Route = createFileRoute("/_authed/(dashboard)/works")({
  component: MyWorks,
  pendingComponent: ContentLoading,
});
