import { createFileRoute } from "@tanstack/react-router";
import { buildExamplesHead, ExamplesPage } from "@/components/video/examples-page";

export const Route = createFileRoute("/_public/(marketing)/examples")({
  head: buildExamplesHead,
  component: ExamplesPage,
});
