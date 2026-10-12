import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { author, blog, category } from "fumadocs-mdx:collections/server";
import { fumadocsI18n } from "./fumadocs-i18n";

export interface BlogFrontmatter {
  title: string;
  description?: string;
  date: string;
  published: boolean;
  featured?: boolean;
  readTime?: string;
  thumbnail?: string;
  author: string;
  categories: string[];
  tags?: string[];
}

export interface BlogPage {
  url: string;
  path: string;
  slugs: string[];
  locale: string;
  data: BlogFrontmatter;
}

export interface AuthorFrontmatter {
  name: string;
  avatar?: string;
  description?: string;
  position?: string;
}

export interface AuthorPage {
  url: string;
  path: string;
  slugs: string[];
  locale: string;
  data: AuthorFrontmatter;
}

export interface CategoryFrontmatter {
  name: string;
  description?: string;
}

export interface CategoryPage {
  url: string;
  path: string;
  slugs: string[];
  locale: string;
  data: CategoryFrontmatter;
}

export const blogSource = loader({
  baseUrl: "/blog",
  i18n: fumadocsI18n,
  source: toFumadocsSource(blog, []),
});

export const authorSource = loader({
  baseUrl: "/author",
  i18n: fumadocsI18n,
  source: toFumadocsSource(author, []),
});

export const categorySource = loader({
  baseUrl: "/category",
  i18n: fumadocsI18n,
  source: toFumadocsSource(category, []),
});

export function getPublishedBlogPages(locale: string): BlogPage[] {
  const pages = blogSource.getPages(locale) as BlogPage[];
  return pages.filter((page) => page.data.published !== false);
}

export function sortBlogPagesByDateDesc(pages: BlogPage[]): BlogPage[] {
  return [...pages].sort((a, b) => {
    const aTime = new Date(a.data.date).getTime();
    const bTime = new Date(b.data.date).getTime();
    return bTime - aTime;
  });
}

export function getBlogPageBySlug(slug: string, locale: string): BlogPage | undefined {
  return blogSource.getPage([slug], locale) as BlogPage | undefined;
}

export function getAuthorPageBySlug(slug: string, locale: string): AuthorPage | undefined {
  return authorSource.getPage([slug], locale) as AuthorPage | undefined;
}

export function getCategoryPageBySlug(slug: string, locale: string): CategoryPage | undefined {
  return categorySource.getPage([slug], locale) as CategoryPage | undefined;
}
