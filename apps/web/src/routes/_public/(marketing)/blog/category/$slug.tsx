import { formatDate } from "@repo/shared";
import { localeToDateFormat } from "@repo/i18n";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BlogCard } from "@/components/blog/blog-card";
import { BlogCategoryFilter } from "@/components/blog/blog-category-filter";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages, type Locale, useLocale, useTranslations } from "@/i18n";
import { buildSeoHead } from "@/utils/seo";

type CategoryLoaderData = {
  selectedCategory: {
    slug: string;
    name: string;
    description?: string;
  };
  categories: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
  posts: Array<{
    slug: string;
    title: string;
    description?: string;
    date: string;
    thumbnail?: string;
    categories: string[];
    authorName?: string;
  }>;
};

export const Route = createFileRoute("/_public/(marketing)/blog/category/$slug")({
  loader: async ({ params }): Promise<CategoryLoaderData> => {
    const locale = getCurrentLocale();
    const data = await serverLoader({ data: { slug: params.slug, locale } });
    if (!data) {
      throw notFound();
    }
    return data;
  },
  head: ({ loaderData }) => {
    const locale = getCurrentLocale();
    const messages = getMessages(locale);
    const categoryName = loaderData?.selectedCategory.name ?? messages.blog.list.title;
    const description = loaderData?.selectedCategory.description ?? messages.blog.list.description;

    return buildSeoHead({
      locale,
      title: `${categoryName} | ${messages.blog.list.title} | ${webConfig.AppName}`,
      description,
      canonicalPath: `/blog/category/${loaderData?.selectedCategory.slug ?? ""}`,
      type: "article",
      siteName: webConfig.AppName,
    });
  },
  component: RouteComponent,
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((data: { slug: string; locale: Locale }) => data)
  .handler(async ({ data: { slug, locale } }): Promise<CategoryLoaderData | null> => {
    const {
      authorSource,
      categorySource,
      getCategoryPageBySlug,
      getPublishedBlogPages,
      sortBlogPagesByDateDesc,
    } = await import("@/lib/blog-source");
    const selectedCategory = getCategoryPageBySlug(slug, locale);
    if (!selectedCategory) {
      return null;
    }

    const posts = sortBlogPagesByDateDesc(getPublishedBlogPages(locale)).filter((post) =>
      post.data.categories.includes(slug),
    );
    const authorPages = authorSource.getPages(locale);
    const categoryPages = categorySource.getPages(locale);

    const authorNameBySlug = new Map(
      authorPages.map((item) => [item.slugs[0], item.data.name] as const),
    );
    const categoryNameBySlug = new Map(
      categoryPages.map((item) => [item.slugs[0], item.data.name] as const),
    );
    const categoryCountBySlug = new Map<string, number>();

    getPublishedBlogPages(locale).forEach((post) => {
      post.data.categories.forEach((categorySlug) => {
        categoryCountBySlug.set(categorySlug, (categoryCountBySlug.get(categorySlug) ?? 0) + 1);
      });
    });

    return {
      selectedCategory: {
        slug: selectedCategory.slugs[0] ?? slug,
        name: selectedCategory.data.name,
        description: selectedCategory.data.description,
      },

      categories: categoryPages
        .map((category) => ({
          slug: category.slugs[0] ?? "",
          name: category.data.name,
          count: categoryCountBySlug.get(category.slugs[0] ?? "") ?? 0,
        }))
        .filter((item) => item.slug.length > 0 && item.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),

      posts: posts.map((post) => ({
        slug: post.slugs.join("/"),
        title: post.data.title,
        description: post.data.description,
        date: post.data.date,
        thumbnail: post.data.thumbnail,
        categories: post.data.categories.map(
          (categorySlug) => categoryNameBySlug.get(categorySlug) ?? categorySlug,
        ),
        authorName: authorNameBySlug.get(post.data.author),
      })),
    };
  });

function RouteComponent() {
  const t = useTranslations("blog.list");
  const locale = useLocale();
  const { selectedCategory, categories, posts } = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
      <section className="space-y-4 border-b border-border pb-8">
        <h1 className="text-4xl font-semibold tracking-tight">{selectedCategory.name}</h1>
        <p className="max-w-2xl text-muted-foreground">
          {selectedCategory.description ?? t("description")}
        </p>
        <BlogCategoryFilter
          categories={categories}
          selectedCategorySlug={selectedCategory.slug}
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
