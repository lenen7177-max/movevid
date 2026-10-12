import { useEffect } from "react";

const BLOG_SCROLL_OFFSET = 80;

export function HashScrollHandler() {
  useEffect(() => {
    let initialScrollTimer: ReturnType<typeof setTimeout> | undefined;
    const handleHashScroll = () => {
      const hash = window.location.hash;
      if (hash) {
        const element = document.getElementById(hash.slice(1));
        if (element) {
          const offset = BLOG_SCROLL_OFFSET; // Match the offset used in table-of-contents
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });

          // Fallback: if browser doesn't support smooth behavior
          if (!CSS.supports("scroll-behavior", "smooth")) {
            element.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
          }
        }
      }
    };

    // Handle hash on page load
    if (window.location.hash) {
      // Delay execution to ensure page is fully loaded
      initialScrollTimer = setTimeout(handleHashScroll, 150);
    }

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashScroll);

    return () => {
      if (initialScrollTimer) clearTimeout(initialScrollTimer);
      window.removeEventListener("hashchange", handleHashScroll);
    };
  }, []);

  return null;
}
