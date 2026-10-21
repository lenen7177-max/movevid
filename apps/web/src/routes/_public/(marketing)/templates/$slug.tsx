import { SINGLE_TEMPLATE_ID, VIDEO_TEMPLATE_IDS } from "@repo/app-config/video";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { NotFound404 } from "@/components/feedback/404/not-found-404";
import { TemplatePage } from "@/components/video/template-page";
import { getCurrentLocale } from "@/i18n";
import { templateIdFromSlug } from "@/lib/video/slug";
import { fetchTemplateGuide } from "@/lib/video/template-guide";
import { buildTemplateHead } from "@/lib/video/template-seo";

export const Route = createFileRoute("/_public/(marketing)/templates/$slug")({
  loader: async ({ params }) => {
    const templateId = templateIdFromSlug(params.slug, VIDEO_TEMPLATE_IDS);
    if (!templateId) throw notFound();
    // A single-template site serves this page as its home page: one URL per page.
    if (templateId === SINGLE_TEMPLATE_ID) throw redirect({ to: "/", statusCode: 301 });
    const guide = await fetchTemplateGuide({ data: { templateId, locale: getCurrentLocale() } });
    return { templateId, guide };
  },
  head: ({ loaderData }) => (loaderData ? buildTemplateHead(loaderData.templateId) : {}),
  component: TemplateRoute,
  notFoundComponent: () => <NotFound404 />,
});

function TemplateRoute() {
  const { templateId, guide } = Route.useLoaderData();
  return <TemplatePage key={templateId} templateId={templateId} guide={guide} />;
}
