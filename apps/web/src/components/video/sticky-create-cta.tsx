import { Button } from "@repo/ui/button";
import { Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Dialogs, sheets and alert dialogs, plus the site header's mobile menu.
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], header [aria-expanded="true"]';

/** Whether a dialog, sheet, alert dialog or the mobile menu is open anywhere on the page. */
function useDialogOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(Boolean(document.querySelector(OVERLAY_SELECTOR)));
    check();
    // Dialogs mount into portals under <body>; the menu flips aria-expanded.
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded"],
    });
    return () => observer.disconnect();
  }, []);
  return open;
}

/** Whether any of the elements (by CSS selector) is at least partly on screen. */
function useAnyVisible(selectors: readonly string[]) {
  // Starts as visible so nothing flashes in before the observer reports.
  const [visible, setVisible] = useState(true);
  const key = selectors.join(",");
  useEffect(() => {
    const elements = [...document.querySelectorAll(key)];
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setVisible(onScreen.size > 0);
    });
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [key]);
  return visible;
}

/** Scrolls to the create form and focuses its first photo slot for keyboard users. */
export function scrollToCreateForm(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  target.querySelector<HTMLElement>("input[type=file]")?.focus({ preventScroll: true });
}

/**
 * Bottom bar on phones and tablets with the create button's label (and price). It shows only
 * while the create form, and anything in `alsoHideOver` (closing CTA, footer), is off screen,
 * so it never covers them, and hides while a dialog is open. A tap scrolls back to the form.
 */
export function StickyCreateCta({
  targetId,
  label,
  alsoHideOver = [],
}: {
  targetId: string;
  label: string | null;
  alsoHideOver?: readonly string[];
}) {
  const coveredVisible = useAnyVisible([`#${targetId}`, ...alsoHideOver]);
  const dialogOpen = useDialogOpen();
  const shown = Boolean(label) && !coveredVisible && !dialogOpen;

  return (
    <div
      data-sticky-cta=""
      aria-hidden={!shown}
      inert={!shown}
      className={cn(
        // inset-x-0 is the viewport width without a scrollbar, so it never overflows sideways.
        "bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-[translate,opacity] duration-200 lg:hidden",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <Button
        type="button"
        size="lg"
        className="h-auto min-h-10 w-full py-2 whitespace-normal"
        onClick={() => scrollToCreateForm(targetId)}
      >
        <Wand2 aria-hidden="true" />
        {label}
      </Button>
    </div>
  );
}
