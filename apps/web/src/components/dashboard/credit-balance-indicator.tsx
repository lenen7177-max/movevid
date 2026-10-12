import { Link } from "@tanstack/react-router";
import { CoinsIcon, ReceiptTextIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { AnimatedNumberText } from "@repo/ui/animated-number-text";
import { Skeleton } from "@repo/ui/skeleton";
import { webConfig } from "@/configs/web-config";
import { useCreditBalanceQuery } from "@/hooks/use-credits";
import { useTranslations } from "@/i18n";

const creditsEnabled = webConfig.creditsEnabled;

function CreditBalanceValue() {
  const t = useTranslations("dashboard.credits");
  const navT = useTranslations("dashboard.nav");
  const creditBalanceQuery = useCreditBalanceQuery();
  const balance = creditBalanceQuery.data?.balance ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-muted/20 px-2.5 text-sm font-medium outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] data-open:bg-muted/40"
            type="button"
            aria-label={`${t("balanceLabel")}: ${balance}`}
            aria-busy={creditBalanceQuery.isLoading}
            title={`${t("balanceLabel")}: ${balance}`}
          />
        }
      >
        <CoinsIcon className="size-4 text-muted-foreground" />
        {creditBalanceQuery.isLoading ? (
          <Skeleton className="h-4 w-7" />
        ) : (
          <AnimatedNumberText value={balance} className="min-w-5 text-right" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/credits/purchase" />}>
            <CoinsIcon />
            {navT("creditPurchase")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/credits/transactions" />}>
            <ReceiptTextIcon />
            {navT("creditTransactions")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CreditBalanceIndicator() {
  if (!creditsEnabled) {
    return null;
  }

  return <CreditBalanceValue />;
}
