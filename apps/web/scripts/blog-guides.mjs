// Pairing of how-to guides with video templates, shared by `pnpm blog:validate` and its tests.
// A post pairs with a template through `template: <template_id>` in its frontmatter; its slug
// should be `how-to-make-<template-slug>` (the id with dashes), e.g. how-to-make-duo-dance.
import fs from "node:fs";

/** Template ids from packages/app-config/src/video.ts (`VIDEO_TEMPLATE_IDS`). */
export function readTemplateIds(videoConfigPath) {
  const source = fs.readFileSync(videoConfigPath, "utf8");
  const list = /export const VIDEO_TEMPLATE_IDS = \[([^\]]*)\]/.exec(source)?.[1] ?? "";
  return [...list.matchAll(/"([a-z0-9_]+)"/g)].map(([, id]) => id);
}

/** The slug a template's guide is expected to have. */
export function guideSlug(templateId) {
  return `how-to-make-${templateId.replace(/_/g, "-")}`;
}

/**
 * Checks the `template:` field of every post. `posts` is [{ slug, template, published }].
 * Errors: an unknown template id, or two posts paired with one template. Warnings (the build
 * still passes): a slug off the convention, or a template without a published guide.
 */
export function checkTemplateGuides(posts, templateIds, { locale = "en" } = {}) {
  const errors = [];
  const warnings = [];
  const known = new Set(templateIds);
  const guideOf = new Map();
  for (const post of posts) {
    if (post.template === undefined) continue;
    const where = `[blog] ${locale}/${post.slug}`;
    if (typeof post.template !== "string" || !known.has(post.template)) {
      errors.push(
        `${where} pairs with unknown template "${String(post.template)}" (known: ${templateIds.join(", ")})`,
      );
      continue;
    }
    if (guideOf.has(post.template)) {
      errors.push(
        `${where} and ${guideOf.get(post.template)} both pair with template "${post.template}"`,
      );
      continue;
    }
    guideOf.set(post.template, post.slug);
    if (post.slug !== guideSlug(post.template)) {
      warnings.push(`${where} pairs with "${post.template}"; name it ${guideSlug(post.template)}`);
    }
    if (post.published === false) {
      warnings.push(`${where} is the guide for "${post.template}" but is not published`);
    }
  }
  for (const id of templateIds) {
    if (!guideOf.has(id)) {
      warnings.push(
        `[blog] ${locale}: template "${id}" has no guide yet (add content/blog/${locale}/${guideSlug(id)}.mdx with template: ${id})`,
      );
    }
  }
  return { errors, warnings };
}
