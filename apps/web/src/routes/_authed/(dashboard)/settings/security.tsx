import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircleIcon, Loader2Icon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { ContentLoading } from "@/components/feedback/full-screen-loading";
import { Skeleton } from "@repo/ui/skeleton";
import { getAuthUrls } from "@/configs/web-config";
import { useUserAuthStatus } from "@/hooks/use-user-auth-status";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { getVisibleUserEmail, isPhoneUser } from "@repo/shared";
import { formatProviderNames } from "@/utils/auth";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authed/(dashboard)/settings/security")({
  component: RouteComponent,
  pendingComponent: ContentLoading,
});

function RouteComponent() {
  const t = useTranslations("dashboard.security");
  const { user } = Route.useRouteContext();
  const passwordStatus = useQuery(orpc.users.getPasswordStatus.queryOptions());
  const [isSending, setIsSending] = useState(false);

  // Use custom hook to manage auth status logic
  const authStatus = useUserAuthStatus({ passwordStatus });
  const { isLoading, isError, isSocialUser, isPasswordUser, socialProviders } = authStatus;
  const visibleEmail = getVisibleUserEmail(user);
  const visiblePhoneNumber = user.phoneNumber ?? null;
  const hasPhoneLogin = isPhoneUser(user);

  const handleSendReset = async () => {
    if (!visibleEmail) return;
    setIsSending(true);
    const authUrls = getAuthUrls();
    await authClient
      .requestPasswordReset(
        {
          email: visibleEmail,
          redirectTo: authUrls.resetPasswordCallbackURL,
        },
        {
          onSuccess: () => {
            toast.success(t("password.resetSent"));
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      )
      .finally(() => setIsSending(false));
  };

  const providerNames = formatProviderNames(socialProviders);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>
            {isSocialUser ? t("socialDescription") : t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 rounded-sm mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </div>
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">{t("password.statusError")}</p>
          ) : isSocialUser ? (
            // Interface for social login users
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">
                      {providerNames} {t("loginMethods.socialLogin")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("loginMethods.socialLoginActive")}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                >
                  {t("loginMethods.active")}
                </Badge>
              </div>

              <Alert>
                <ShieldCheckIcon className="h-4 w-4" />
                <AlertTitle>{t("security.title")}</AlertTitle>
                <AlertDescription>
                  {t("security.socialLoginSecurity", {
                    providers: providerNames,
                  })}
                </AlertDescription>
              </Alert>
            </div>
          ) : hasPhoneLogin ? (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <SmartphoneIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{t("phone.title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("phone.verifiedNumber", {
                      phoneNumber: visiblePhoneNumber ?? "",
                    })}
                  </p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {t("phone.verified")}
              </Badge>
            </div>
          ) : isPasswordUser ? (
            // Interface for users with password
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-medium">{t("password.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("password.description")}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{t("password.hasPassword")}</p>
                <Button disabled={isSending} onClick={handleSendReset}>
                  {isSending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                  {isSending ? t("password.sendingReset") : t("password.sendReset")}
                </Button>
              </div>
            </div>
          ) : (
            // Fallback for unknown state
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
