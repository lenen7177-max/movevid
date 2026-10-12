import { Crown, Loader2 } from "lucide-react";
import { useCurrentSubscription } from "@/hooks/use-payments";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@repo/ui/badge";

type SubscriptionStatusBadgeProps = {
  className?: string;
  compact?: boolean;
  showWhenNoPlan?: boolean;
};

export function SubscriptionStatusBadge({
  className,
  showWhenNoPlan = true,
}: SubscriptionStatusBadgeProps) {
  const t = useTranslations("dashboard.billing");
  const { hasLifetime, hasSubscription, activePrice, currentEntitlement, isLoading, isError } =
    useCurrentSubscription({ includePlan: false });

  const subscriptionMembershipLabel =
    activePrice?.interval === "year"
      ? t("membershipTypes.yearly")
      : activePrice?.interval === "month"
        ? t("membershipTypes.monthly")
        : t("membershipTypes.subscription");

  if (isError) {
    return null;
  }

  if (isLoading) {
    return (
      <Badge className={cn("gap-1", className)} variant="outline">
        <Loader2 className="size-3 animate-spin" />
      </Badge>
    );
  }

  if (hasLifetime) {
    return (
      <Badge className={className} variant="secondary">
        <Crown />
        {t("membershipTypes.lifetime")}
      </Badge>
    );
  }

  if (hasSubscription) {
    return (
      <Badge className={className} variant="secondary">
        <Crown />
        {subscriptionMembershipLabel}
      </Badge>
    );
  }
  if (currentEntitlement?.source === "admin_trial") {
    return (
      <Badge className={className} variant="secondary">
        <Crown />
        {t(`membershipTypes.${currentEntitlement.tier}`)} · {t("trialLabel")}
      </Badge>
    );
  }
  if (!showWhenNoPlan) {
    return null;
  }

  return (
    <Badge className={className} variant="outline">
      {t("free")}
    </Badge>
  );
}
