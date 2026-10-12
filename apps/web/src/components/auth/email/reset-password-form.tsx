import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/field";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

export function ResetPasswordForm({ className, ...props }: React.ComponentProps<"div">) {
  const t = useTranslations();
  const navigate = useNavigate();
  const { token } = useSearch({
    from: "/(auth)/auth/reset-password",
    select: (search) => ({ token: search.token }),
  });

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (!token) {
        toast.error(t("resetPassword.invalidToken"));
        return;
      }
      await authClient.resetPassword(
        {
          newPassword: value.password,
          token,
        },
        {
          onSuccess: () => {
            toast.success(t("resetPassword.success"));
            navigate({ to: "/auth/sign-in" });
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z
        .object({
          password: z.string().min(8, t("auth.validation.passwordMinLength")),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("auth.validation.passwordsNotMatch"),
          path: ["confirmPassword"],
        }),
    },
  });

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-4", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("resetPassword.title")}</CardTitle>
          <CardDescription>{t("resetPassword.description")}</CardDescription>
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
              <form.Field
                name="password"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>{t("resetPassword.newPassword")}</FieldLabel>
                      <PasswordInput
                        id={field.name}
                        autoComplete="new-password"
                        placeholder={t("auth.enterPassword")}
                        aria-invalid={isInvalid}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="confirmPassword"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("resetPassword.confirmPassword")}
                      </FieldLabel>
                      <PasswordInput
                        id={field.name}
                        autoComplete="new-password"
                        placeholder={t("resetPassword.confirmNewPassword")}
                        aria-invalid={isInvalid}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <Field>
                <form.Subscribe>
                  {(state) => (
                    <Button
                      type="submit"
                      className="w-full cursor-pointer"
                      disabled={!state.canSubmit || state.isSubmitting}
                    >
                      {state.isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                      {state.isSubmitting ? t("resetPassword.resetting") : t("resetPassword.reset")}
                    </Button>
                  )}
                </form.Subscribe>
              </Field>
              <div className="text-center text-sm">
                <Link to="/auth/sign-in">{t("resetPassword.backToSignIn")}</Link>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
