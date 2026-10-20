import { useRouter, useRouterState } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import {
  defaultLocale,
  localeDisplayNames,
  type Locale,
  setLocaleCookie,
  shouldIgnorePath,
  supportedLocales,
  useLocale,
  useTranslations,
} from "@/i18n";

type LocaleSwitcherProps = {
  onActionComplete?: () => void;
};

/** Language menu; renders nothing while the site serves a single locale (see @repo/i18n). */
export function LocaleSwitcher({ onActionComplete }: LocaleSwitcherProps = {}) {
  const currentLocale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const completeAction = () => {
    if (!onActionComplete) return;
    window.requestAnimationFrame(() => {
      onActionComplete();
    });
  };

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    completeAction();

    // Update cookie first
    setLocaleCookie(newLocale);

    // Get path without locale prefix (router state is already delocalized)
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

    // For ignored paths (dashboard, api, etc.), just reload - locale comes from cookie
    if (shouldIgnorePath(pathWithoutLocale)) {
      router.navigate({ to: pathWithoutLocale, reloadDocument: true });
      return;
    }

    // For public pages, build new path with new locale prefix
    const newPath =
      newLocale === defaultLocale
        ? pathWithoutLocale
        : `/${newLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

    // Navigate with document reload to apply new translations
    router.navigate({ to: newPath, reloadDocument: true });
  };

  if (supportedLocales.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" />}>
        <Languages className="size-[1.2rem]" />
        <span className="sr-only">{t("locale.switchLanguage")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {supportedLocales.map((locale) => (
            <DropdownMenuItem
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              className={currentLocale === locale ? "bg-accent" : ""}
            >
              {localeDisplayNames[locale]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
