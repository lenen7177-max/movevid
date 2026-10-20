import { defineCollections, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";
import { supportedLocales } from "../../packages/i18n/src/locales";

// Only the served locales' folders (content/<collection>/<locale>/…) are compiled.
const files = supportedLocales.map((locale) => `${locale}/**/*.mdx`);

export const author = defineCollections({
  type: "doc",
  dir: "content/author",
  files,
  schema: z.object({
    name: z.string(),
    avatar: z.string().optional(),
    description: z.string().optional(),
    position: z.string().optional(),
  }),
});

export const category = defineCollections({
  type: "doc",
  dir: "content/category",
  files,
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
});

export const blog = defineCollections({
  type: "doc",
  dir: "content/blog",
  files,
  schema: frontmatterSchema.extend({
    date: z.string(),
    published: z.boolean().default(true),
    featured: z.boolean().optional().default(false),
    readTime: z.string().optional(),
    thumbnail: z.string().optional(),
    author: z.string(),
    categories: z.array(z.string()),
    tags: z.array(z.string()).optional().default([]),
  }),
});
