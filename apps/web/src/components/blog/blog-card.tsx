import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface BlogCardProps {
  slug: string;
  title: string;
  description?: string;
  date: string;
  thumbnail?: string;
  categories: string[];
  authorName?: string;
  showRightBorder?: boolean;
}

export function BlogCard({
  slug,
  title,
  description,
  date,
  thumbnail,
  showRightBorder = true,
}: BlogCardProps) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug }}
      className={cn(
        "group relative block before:absolute before:-left-0.5 before:top-0 before:z-10 before:h-screen before:w-px before:bg-border before:content-[''] after:absolute after:-top-0.5 after:left-0 after:z-0 after:h-px after:w-screen after:bg-border after:content-['']",
        showRightBorder ? "md:border-r border-border border-b-0" : "",
      )}
    >
      <div className="flex h-full flex-col">
        {thumbnail ? (
          <div className="relative h-48 w-full overflow-hidden">
            <img
              src={thumbnail}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-6">
          <h3 className="text-xl font-semibold text-card-foreground group-hover:underline underline-offset-4">
            {title}
          </h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          <time className="mt-auto block text-sm font-medium text-muted-foreground">{date}</time>
        </div>
      </div>
    </Link>
  );
}
