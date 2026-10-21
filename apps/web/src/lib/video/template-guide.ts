import type { VideoTemplateId } from "@repo/app-config/video";
import { createServerFn } from "@tanstack/react-start";
import type { Locale } from "@/i18n";

/** A template's paired how-to guide, as the landing page links to it. */
export type TemplateGuide = { path: string; title: string; description?: string };

/**
 * The blog post whose frontmatter says `template: <templateId>` (slug convention
 * how-to-make-<template-slug>), or null while the template has none.
 */
export const fetchTemplateGuide = createServerFn({ method: "GET" })
  .inputValidator((data: { templateId: VideoTemplateId; locale: Locale }) => data)
  .handler(async ({ data: { templateId, locale } }): Promise<TemplateGuide | null> => {
    const { getTemplateGuidePage } = await import("@/lib/blog-source");
    const page = getTemplateGuidePage(templateId, locale);
    return page
      ? {
          path: `/blog/${page.slugs.join("/")}`,
          title: page.data.title,
          description: page.data.description,
        }
      : null;
  });
