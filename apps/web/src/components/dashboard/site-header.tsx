import { ThemeSwitch } from "@/components/features/theme-switch";
import { LocaleSwitcher } from "@/components/i18n";
import { Separator } from "@repo/ui/separator";
import { SidebarTrigger } from "@repo/ui/sidebar";
import { CreditBalanceIndicator } from "./credit-balance-indicator";
import { Search } from "./search";

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />

        <Search />

        <div className="ml-auto flex items-center gap-2">
          <CreditBalanceIndicator />
          <LocaleSwitcher />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
