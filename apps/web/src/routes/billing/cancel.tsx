import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircleIcon } from "lucide-react";
import { buttonVariants } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { useTranslations } from "@/i18n";

export const Route = createFileRoute("/billing/cancel")({
  component: RouteComponent,
});

function RouteComponent() {
  const t = useTranslations("billingCancel");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircleIcon className="size-5 text-amber-500" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          <Link className={buttonVariants({ variant: "outline" })} to="/settings/billing">
            {t("backToBilling")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
