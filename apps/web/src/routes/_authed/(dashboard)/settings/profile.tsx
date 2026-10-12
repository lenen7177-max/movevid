import { getAcceptString } from "@repo/app-config/storage";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2Icon, UserIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { RoleBadge } from "@/components/dashboard/users/role-badge";
import { ContentLoading } from "@/components/feedback/full-screen-loading";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { webConfig } from "@/configs/web-config";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { client, orpc } from "@/utils/orpc";
import { getVisibleUserEmail, isPhoneUser } from "@repo/shared";

export const Route = createFileRoute("/_authed/(dashboard)/settings/profile")({
  component: RouteComponent,
  pendingComponent: ContentLoading,
});

function RouteComponent() {
  const t = useTranslations("dashboard.settings.profile");
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const authSession = authClient.useSession();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateProfile = useMutation({
    ...orpc.users.update.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("success"));
      await authSession.refetch({ query: { disableCookieCache: true } });
      router.invalidate();
    },
    onError: (error: Error) => {
      toast.error(`${t("error")}: ${error.message}`);
    },
  });

  const visibleEmail = getVisibleUserEmail(user);
  const visiblePhoneNumber = user.phoneNumber ?? null;
  const hasPhoneLogin = isPhoneUser(user);
  const isStorageEnabled = webConfig.storageEnabled;

  const handleAvatarUpload = async (file: File) => {
    if (!isStorageEnabled) return;

    setIsUploading(true);
    try {
      const { url } = await client.storage.upload({ file, purpose: "avatar" });
      await updateProfile.mutateAsync({ image: url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("avatarUploadError"));
    }
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const form = useForm({
    defaultValues: {
      name: user.name ?? "",
    },
    onSubmit: async ({ value }) => {
      updateProfile.mutate({
        name: value.name,
      });
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, t("nameMinLength")).max(20, t("nameMaxLength")),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="size-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="flex items-center gap-x-6 py-2">
                <Avatar className="size-20">
                  <AvatarImage src={user.image || ""} />
                  <AvatarFallback className="text-lg">
                    {user.name?.slice(0, 2).toUpperCase() || "UN"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium">{user.name || t("name")}</h4>
                    <RoleBadge role={user.role} />
                  </div>
                  {isStorageEnabled ? (
                    <>
                      <p className="text-sm text-muted-foreground">{t("avatarDescription")}</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={getAcceptString("avatar")}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleAvatarUpload(file);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isUploading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                        {isUploading ? t("avatarUploading") : t("changeAvatar")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <FieldSeparator />

              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>{t("name")}</FieldLabel>
                      <Input
                        id={field.name}
                        placeholder={t("namePlaceholder")}
                        aria-invalid={isInvalid}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <FieldDescription>{t("nameDescription")}</FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              {!hasPhoneLogin && (
                <Field>
                  <FieldLabel>{t("email")}</FieldLabel>
                  <Input disabled value={visibleEmail ?? t("notLinked")} />
                  <FieldDescription>{t("emailDescription")}</FieldDescription>
                </Field>
              )}

              {hasPhoneLogin && (
                <Field>
                  <FieldLabel>{t("phone")}</FieldLabel>
                  <Input disabled value={visiblePhoneNumber ?? t("notLinked")} />
                  <FieldDescription>{t("phoneDescription")}</FieldDescription>
                </Field>
              )}

              <div className="flex justify-end">
                <form.Subscribe>
                  {(state) => (
                    <Button
                      type="submit"
                      disabled={!state.canSubmit || state.isSubmitting || updateProfile.isPending}
                    >
                      {(state.isSubmitting || updateProfile.isPending) && (
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                      )}
                      {updateProfile.isPending ? t("saving") : t("save")}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
