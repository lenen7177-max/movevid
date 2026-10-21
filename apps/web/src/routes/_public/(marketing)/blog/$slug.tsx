import { formatDate } from "@repo/shared";
import { localeToDateFormat } from "@repo/i18n";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import browserCollections from "fumadocs-mdx:collections/browser";
import { ArrowLeft } from "lucide-react";
import type { MDXComponents } from "mdx/types";
import { Suspense } from "react";
import { BlogAuthorCard } from "@/components/blog/blog-author-card";
import { getBlogMdxComponents } from "@/components/blog/blog-mdx-components";
import { HashScrollHandler } from "@/components/blog/hash-scroll-handler";
import { MobileToc } from "@/components/blog/mobile-toc";
import { ReadMoreSection } from "@/components/blog/read-more-section";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { TemplateCta } from "@/components/blog/template-cta";
import { type VideoTemplateId, isVideoTemplateId } from "@repo/app-config/video";
import { buttonVariants } from "@repo/ui/button";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, type Locale, useLocale, useTranslations } from "@/i18n";
import { buildSeoHead } from "@/utils/seo";

type DetailLoaderData = {
  path: string;
  post: {
    slug: string;
    title: string;
    description?: string;
    date: string;
    /** Day of the last substantive change, when the frontmatter sets `updated`. */
    updated?: string;
    thumbnail?: string;
    readTime?: string;
    categories: Array<{ slug: string; name: string }>;
    /** Set when the post is a template's how-to guide. */
    template: VideoTemplateId | null;
  };
  author?: {
    name: string;
    description?: string;
    position?: string;
    avatar?: string;
  };
  relatedPosts: Array<{
    slug: string;
    title: string;
    description?: string;
    date: string;
    thumbnail?: string;
  }>;
  seo: {
    title: string;
    description?: string;
    canonicalPath: string;
    image?: string;
  };
};

const clientLoader = browserCollections.blog.createClientLoader({
  component({ default: MDX }, props: { components?: MDXComponents }) {
    return <MDX components={props.components} />;
  },
});

export const Route = createFileRoute("/_public/(marketing)/blog/$slug")({
  loader: async ({ params }) => {
    const locale = getCurrentLocale();
    const data = await serverLoader({ data: { slug: params.slug, locale } });
    await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => {
    const locale = getCurrentLocale();
    const messages = getMessages(locale);
    const title = loaderData?.seo.title ?? messages.blog.list.title;
    const description = loaderData?.seo.description ?? messages.blog.list.description;

    const canonicalPath = loaderData?.seo.canonicalPath ?? "/blog";
    const post = loaderData?.post;

    return buildSeoHead({
      locale,
      title: `${title} | ${webConfig.AppName}`,
      description,
      canonicalPath,
      image: loaderData?.seo.image,
      imageAlt: title,
      type: "article",
      siteName: webConfig.AppName,
      ldJson: post
        ? {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BlogPosting",
                headline: post.title,
                description,
                datePublished: post.date,
                dateModified: post.updated ?? post.date,
                inLanguage: locale,
                image: post.thumbnail ? `${webConfig.AppUrl}${post.thumbnail}` : undefined,
                mainEntityOfPage: `${webConfig.AppUrl}${canonicalPath}`,
                author: {
                  "@type": "Organization",
                  name: loaderData?.author?.name ?? webConfig.AppName,
                },
                publisher: { "@type": "Organization", name: webConfig.AppName },
              },
            ],
          }
        : undefined,
    });
  },
  component: RouteComponent,
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((data: { slug: string; locale: Locale }) => data)
  .handler(async ({ data: { slug, locale } }): Promise<DetailLoaderData> => {
    const {
      authorSource,
      categorySource,
      getBlogPageBySlug,
      getPublishedBlogPages,
      sortBlogPagesByDateDesc,
    } = await import("@/lib/blog-source");

    const post = getBlogPageBySlug(slug, locale);
    if (!post || post.data.published === false) {
      throw notFound();
    }

    const author = authorSource.getPage([post.data.author], locale);
    const categoryPages = categorySource.getPages(locale);
    const categoryNameBySlug = new Map(
      categoryPages.map((item) => [item.slugs[0], item.data.name] as const),
    );

    const categories = post.data.categories.map((categorySlug) => ({
      slug: categorySlug,
      name: categoryNameBySlug.get(categorySlug) ?? categorySlug,
    }));

    const relatedPosts = sortBlogPagesByDateDesc(getPublishedBlogPages(locale))
      .filter((item) => item.url !== post.url)
      .map((item) => {
        const relevance = item.data.categories.filter((categorySlug) =>
          post.data.categories.includes(categorySlug),
        ).length;
        return {
          slug: item.slugs.join("/"),
          title: item.data.title,
          description: item.data.description,
          date: item.data.date,
          thumbnail: item.data.thumbnail,
          relevance,
        };
      })
      .sort((a, b) => {
        if (a.relevance !== b.relevance) return b.relevance - a.relevance;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 3)
      .map(({ relevance: _relevance, ...item }) => item);

    return {
      path: post.path,
      post: {
        slug,
        title: post.data.title,
        description: post.data.description,
        date: post.data.date,
        updated: post.data.updated,
        thumbnail: post.data.thumbnail,
        readTime: post.data.readTime,
        categories,
        template: isVideoTemplateId(post.data.template) ? post.data.template : null,
      },
      author: author
        ? {
            name: author.data.name,
            description: author.data.description,
            position: author.data.position,
            avatar: author.data.avatar,
          }
        : undefined,
      relatedPosts,
      seo: {
        title: post.data.title,
        description: post.data.description,
        canonicalPath: `/blog/${slug}`,
        image: post.data.thumbnail,
      },
    };
  });

function RouteComponent() {
  const locale = useLocale();
  const t = useTranslations("blog.detail");
  const loaderData = Route.useLoaderData();
  const data = useFumadocsLoader(loaderData);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
      <HashScrollHandler />
      <div className="relative z-10 space-y-4 border-b border-border">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center gap-3 gap-y-5 text-sm text-muted-foreground">
            <Link
              className={buttonVariants({ variant: "outline", className: "h-6 w-6" })}
              to="/blog"
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only">{t("backToBlog")}</span>
            </Link>
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              {loaderData.post.categories.map((category) => (
                <span
                  key={category.slug}
                  className="flex h-6 w-fit items-center justify-center rounded-md border bg-muted px-3 text-sm font-medium text-muted-foreground"
                >
                  {category.name}
                </span>
              ))}
            </div>
            <time className="font-medium text-muted-foreground">
              {formatDate(locale, loaderData.post.date, localeToDateFormat)}
            </time>
            {loaderData.post.readTime ? (
              <span className="font-medium text-muted-foreground">{loaderData.post.readTime}</span>
            ) : null}
          </div>

          <h1 className="text-balance text-4xl font-medium tracking-tighter md:text-5xl lg:text-6xl">
            {loaderData.post.title}
          </h1>

          {loaderData.post.description ? (
            <p className="max-w-4xl text-muted-foreground md:text-balance md:text-lg">
              {loaderData.post.description}
            </p>
          ) : null}
          {loaderData.post.template ? (
            <TemplateCta templateId={loaderData.post.template} className="max-w-4xl" />
          ) : null}
        </div>
      </div>
      <div className="relative z-10 flex border-x border-border lg:items-start lg:divide-x lg:divide-border">
        <article className="w-full overflow-hidden">
          {loaderData.post.thumbnail ? (
            <div className="relative h-[500px] w-full overflow-hidden object-cover">
              <img
                src={loaderData.post.thumbnail}
                alt={loaderData.post.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div className="p-6 lg:p-10">
            <div
              id="blog-content"
              className="prose prose-lg prose-zinc max-w-none dark:prose-invert prose-headings:scroll-mt-8 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-balance prose-a:no-underline prose-p:tracking-tight prose-p:text-balance"
            >
              <Suspense
                fallback={<div className="text-sm text-muted-foreground">{t("loading")}</div>}
              >
                {clientLoader.useContent(data.path, {
                  components: getBlogMdxComponents(),
                })}
              </Suspense>
            </div>
            {loaderData.post.template ? (
              <TemplateCta templateId={loaderData.post.template} className="mt-10" />
            ) : null}
          </div>

          <div className="mt-10">
            <ReadMoreSection
              title={t("readMore")}
              posts={loaderData.relatedPosts.map((post) => ({
                ...post,
                date: formatDate(locale, post.date, localeToDateFormat),
              }))}
            />
          </div>
        </article>

        <aside className="hidden w-[350px] shrink-0 p-6 lg:sticky lg:top-20 lg:block lg:self-start lg:p-10">
          <div className="space-y-8">
            {loaderData.author ? <BlogAuthorCard {...loaderData.author} /> : null}
            <div className="rounded-lg border border-border bg-card p-6">
              <TableOfContents title={t("onThisPage")} refreshKey={loaderData.post.slug} />
            </div>
          </div>
        </aside>
      </div>

      <MobileToc title={t("onThisPage")} refreshKey={loaderData.post.slug} />
    </main>
  );
}
