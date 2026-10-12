import { Link } from "@tanstack/react-router";

interface ReadMorePost {
  slug: string;
  title: string;
  description?: string;
  date: string;
  thumbnail?: string;
}

interface ReadMoreSectionProps {
  title: string;
  posts: ReadMorePost[];
}

export function ReadMoreSection({ title, posts }: ReadMoreSectionProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border p-0">
      <div className="p-6 lg:p-10">
        <h2 className="mb-8 text-2xl font-medium">{title}</h2>
        <div className="flex flex-col gap-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="group grid cursor-pointer grid-cols-1 items-center gap-4 lg:grid-cols-12"
            >
              {post.thumbnail ? (
                <div className="col-span-1 shrink-0 lg:col-span-4">
                  <div className="relative h-full w-full">
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      className="h-full w-full rounded-lg object-cover transition-opacity group-hover:opacity-80"
                    />
                  </div>
                </div>
              ) : null}
              <div className="col-span-1 flex-1 space-y-2 lg:col-span-8">
                <h3 className="line-clamp-2 text-lg font-semibold text-card-foreground group-hover:text-primary group-hover:underline underline-offset-4 transition-colors">
                  {post.title}
                </h3>
                {post.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground group-hover:underline underline-offset-4">
                    {post.description}
                  </p>
                ) : null}
                <time className="block text-xs font-medium text-muted-foreground">{post.date}</time>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
