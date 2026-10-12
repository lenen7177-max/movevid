import { buttonVariants } from "@repo/ui/button";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CreditBalanceIndicator } from "@/components/dashboard/credit-balance-indicator";
import { ThemeSwitch } from "@/components/features/theme-switch";
import { LocaleSwitcher } from "@/components/i18n";
import { BrandLogo } from "@/components/logos/brand-logo";
import UserMenu from "@/components/navigation/user-menu";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

type NavLink = {
  key: "templates" | "studio" | "howItWorks" | "pricing" | "faq";
  to: string;
  hash?: string;
};

const NAV_LINKS: NavLink[] = [
  { key: "templates", to: "/templates" },
  { key: "studio", to: "/studio" },
  { key: "howItWorks", to: "/", hash: "how-it-works" },
  { key: "pricing", to: "/pricing" },
  { key: "faq", to: "/", hash: "faq" },
];

/** Marketing header: logo, centered links, account actions. Turns translucent on scroll. */
export function SiteHeader() {
  const t = useTranslations("video.nav");
  const { data: session } = authClient.useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        scrolled || open
          ? "bg-background/75 supports-[backdrop-filter]:bg-background/60 border-border backdrop-blur-xl"
          : "border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to="/" aria-label={t("home")} className="flex shrink-0 items-center" onClick={close}>
          <BrandLogo size={28} />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.key}>
              <Link
                to={link.to}
                hash={link.hash}
                className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-sm transition-colors"
                activeOptions={{ exact: true, includeHash: true }}
                activeProps={link.hash ? undefined : { className: "text-foreground" }}
              >
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeSwitch />
          <LocaleSwitcher />
          {session?.user ? <CreditBalanceIndicator /> : null}
          <UserMenu />
          <Link
            to="/studio"
            className={buttonVariants({ size: "sm", className: "rounded-full px-4" })}
          >
            {t("startCreating")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? t("closeMenu") : t("openMenu")}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="hover:bg-muted -mr-2 rounded-full p-2 lg:hidden"
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-menu"
          className="bg-background/95 h-[calc(100dvh-4rem)] overflow-y-auto border-t px-4 pt-6 pb-10 backdrop-blur-xl lg:hidden"
        >
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.key}>
                <Link
                  to={link.to}
                  hash={link.hash}
                  onClick={close}
                  className="hover:bg-muted block rounded-2xl px-3 py-3 text-2xl font-medium tracking-tight"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-6">
            <ThemeSwitch onActionComplete={close} />
            <LocaleSwitcher onActionComplete={close} />
            {session?.user ? <CreditBalanceIndicator /> : null}
            <UserMenu onActionComplete={close} />
          </div>
          <Link
            to="/studio"
            onClick={close}
            className={buttonVariants({ size: "lg", className: "mt-6 w-full rounded-full" })}
          >
            {t("startCreating")}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
