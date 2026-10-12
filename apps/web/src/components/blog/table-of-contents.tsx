import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useOptionalCustomDrawer } from "@repo/ui/mobile-drawer";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  title: string;
  className?: string;
  contentSelector?: string;
  onItemClick?: () => void;
  refreshKey?: string;
}

export function TableOfContents({
  title,
  className,
  contentSelector = "#blog-content",
  onItemClick,
  refreshKey,
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const drawerContext = useOptionalCustomDrawer();

  useEffect(() => {
    const root = document.querySelector(contentSelector);
    if (!root) {
      const clearFrame = requestAnimationFrame(() => {
        setHeadings([]);
        setActiveId("");
      });
      return () => cancelAnimationFrame(clearFrame);
    }
    const collectHeadings = () => {
      const headingElements = root.querySelectorAll("h1, h2");
      const nextHeadings: Heading[] = [];

      headingElements.forEach((element) => {
        if (!element.id) return;
        nextHeadings.push({
          id: element.id,
          text: element.textContent ?? "",
          level: Number.parseInt(element.tagName.charAt(1), 10),
        });
      });

      setHeadings(nextHeadings);
    };

    const initialCollectFrame = requestAnimationFrame(collectHeadings);

    const observer = new MutationObserver(() => {
      collectHeadings();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(initialCollectFrame);
      observer.disconnect();
    };
  }, [contentSelector, refreshKey]);

  useEffect(() => {
    if (headings.length === 0) {
      const clearFrame = requestAnimationFrame(() => setActiveId(""));
      return () => cancelAnimationFrame(clearFrame);
    }

    const resolveActiveHeading = (rangeTop: number, rangeBottom: number) => {
      const headingPositions = headings.map((heading) => {
        const element = document.getElementById(heading.id);
        return {
          id: heading.id,
          top: element ? element.getBoundingClientRect().top : Number.POSITIVE_INFINITY,
        };
      });

      let activeHeading = headingPositions.find(
        (heading) => heading.top >= rangeTop && heading.top <= rangeBottom,
      );

      if (!activeHeading) {
        const headingsAbove = headingPositions
          .filter((heading) => heading.top < rangeTop)
          .sort((a, b) => b.top - a.top);
        activeHeading = headingsAbove[0];
      }

      if (!activeHeading) {
        const headingsBelow = headingPositions
          .filter((heading) => heading.top > rangeBottom)
          .sort((a, b) => a.top - b.top);
        activeHeading = headingsBelow[0];
      }

      if (activeHeading && activeHeading.id !== activeId) {
        setActiveId(activeHeading.id);
      }
    };

    const observer = new IntersectionObserver(
      () => {
        resolveActiveHeading(0, 100);
      },
      {
        root: null,
        rootMargin: "-100px",
        threshold: 0,
      },
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    const handleScroll = () => {
      resolveActiveHeading(-50, 100);
    };

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const throttledScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(handleScroll, 10);
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });
    const initialScrollFrame = requestAnimationFrame(handleScroll);

    return () => {
      cancelAnimationFrame(initialScrollFrame);
      observer.disconnect();
      window.removeEventListener("scroll", throttledScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [headings, activeId]);

  const handleClick = async (id: string) => {
    setActiveId(id);
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    window.history.pushState({}, "", `#${id}`);

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

    const element = document.getElementById(id);
    if (!element) return;

    const offset = 80;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });

    if (!CSS.supports("scroll-behavior", "smooth")) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    }

    onItemClick?.();
    if (drawerContext) {
      drawerContext.setIsOpen(false);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="mb-4 text-sm font-semibold text-foreground">{title}</h4>
      <nav>
        <ul className="space-y-2">
          {headings.map((heading) => (
            <li key={heading.id}>
              <button
                type="button"
                onClick={() => {
                  handleClick(heading.id);
                }}
                className={cn(
                  "block w-full text-left text-sm text-muted-foreground transition-colors hover:text-foreground",
                  activeId === heading.id
                    ? "font-medium text-primary underline underline-offset-4"
                    : "",
                )}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
