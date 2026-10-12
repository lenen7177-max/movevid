import { formatDate } from "@repo/shared";
import { localeToDateFormat } from "@repo/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BlogCard } from "@/components/blog/blog-card";
import { BlogCategoryFilter } from "@/components/blog/blog-category-filter";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, type Locale, useLocale, useTranslations } from "@/i18n";
import { buildSeoHead } from "@/utils/seo";

type ListCategory = {
  slug: string;
  name: string;
  count: number;
};

type ListPost = {
  slug: string;
  title: string;
  description?: string;
  date: string;
  thumbnail?: string;
  categories: string[];
  authorName?: string;
};

type BlogListLoaderData = {
  posts: ListPost[];
  categories: ListCategory[];
};

export const Route = createFileRoute("/_public/(marketing)/blog/")({
  loader: async (): Promise<BlogListLoaderData> => {
    const locale = getCurrentLocale();
    return serverLoader({ data: { locale } });
  },
  head: () => {
    const locale = getCurrentLocale();
    const messages = getMessages(locale);
    return buildSeoHead({
      locale,
      title: `${messages.blog.list.title} | ${webConfig.AppName}`,
      description: messages.blog.list.description,
      canonicalPath: "/blog",
      type: "article",
      siteName: webConfig.AppName,
      ldJson: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: messages.blog.list.title,
        description: messages.blog.list.description,
        inLanguage: locale,
      },
    });
  },
  component: RouteComponent,
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((data: { locale: Locale }) => data)
  .handler(async ({ data: { locale } }): Promise<BlogListLoaderData> => {
    const { authorSource, categorySource, getPublishedBlogPages, sortBlogPagesByDateDesc } =
      await import("@/lib/blog-source");
    const posts = sortBlogPagesByDateDesc(getPublishedBlogPages(locale));
    const authorPages = authorSource.getPages(locale);
    const categoryPages = categorySource.getPages(locale);

    const authorNameBySlug = new Map(
      authorPages.map((item) => [item.slugs[0], item.data.name] as const),
    );
    const categoryNameBySlug = new Map(
      categoryPages.map((item) => [item.slugs[0], item.data.name] as const),
    );
    const categoryCountBySlug = new Map<string, number>();

    const mappedPosts = posts.map((post) => {
      post.data.categories.forEach((slug) => {
        categoryCountBySlug.set(slug, (categoryCountBySlug.get(slug) ?? 0) + 1);
      });

      return {
        slug: post.slugs.join("/"),
        title: post.data.title,
        description: post.data.description,
        date: post.data.date,
        thumbnail: post.data.thumbnail,
        categories: post.data.categories.map((slug) => categoryNameBySlug.get(slug) ?? slug),
        authorName: authorNameBySlug.get(post.data.author),
      } satisfies ListPost;
    });

    const categories = categoryPages
      .map((category) => ({
        slug: category.slugs[0] ?? "",
        name: category.data.name,
        count: categoryCountBySlug.get(category.slugs[0] ?? "") ?? 0,
      }))
      .filter((item) => item.slug.length > 0 && item.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      posts: mappedPosts,
      categories,
    };
  });

function RouteComponent() {
  const t = useTranslations("blog.list");
  const locale = useLocale();
  const { posts, categories } = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
      <section className="space-y-4 border-b border-border pb-8">
        <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
        <BlogCategoryFilter
          categories={categories}
          allLabel={t("allCategories")}
          selectCategoryLabel={t("selectCategory")}
        />
      </section>
      <section className="mt-8">
        {posts.length > 0 ? (
          <div className="relative overflow-hidden border-x border-b border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard
                  key={post.slug}
                  slug={post.slug}
                  title={post.title}
                  description={post.description}
                  date={formatDate(locale, post.date, localeToDateFormat)}
                  thumbnail={post.thumbnail}
                  categories={post.categories}
                  authorName={post.authorName}
                  showRightBorder={posts.length < 3}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {t("empty")}
          </div>
        )}
      </section>
    </main>
  );
}
