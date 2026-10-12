import type { HTMLAttributes, ReactNode } from "react";
import { LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyHeaderProps extends HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

export function CopyHeader({ level, children, className, ...props }: CopyHeaderProps) {
  const text = typeof children === "string" ? children : "";
  const id = generateSlug(text);
  const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  async function copyToClipboard() {
    if (typeof window === "undefined") return;

    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    window.history.pushState({}, "", `#${id}`);

    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }

  if (level === 1 || level === 2) {
    return (
      <HeadingTag
        id={id}
        onClick={copyToClipboard}
        className={cn(
          "group flex cursor-pointer items-center gap-2 scroll-mt-20 transition-colors hover:text-muted-foreground",
          className,
        )}
        title="Copy section link"
        {...props}
      >
        {children}
        <LinkIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </HeadingTag>
    );
  }

  return (
    <HeadingTag id={id} className={cn("scroll-mt-20", className)} {...props}>
      {children}
    </HeadingTag>
  );
}
