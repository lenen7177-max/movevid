import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { getAuthUrls } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm({ className, ...props }: React.ComponentProps<"div">) {
  const t = useTranslations();

  const form = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      const authUrls = getAuthUrls();
      await authClient.requestPasswordReset(
        {
          email: value.email,
          redirectTo: authUrls.resetPasswordCallbackURL,
        },
        {
          onSuccess: () => {
            toast.success(t("forgotPassword.success"));
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email(t("auth.validation.invalidEmail")),
      }),
    },
  });

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-4", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("forgotPassword.title")}</CardTitle>
          <CardDescription>{t("forgotPassword.description")}</CardDescription>
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
                name="email"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>{t("auth.email")}</FieldLabel>
                      <Input
                        id={field.name}
                        type="email"
                        placeholder={t("auth.enterEmail")}
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
                      {state.isSubmitting
                        ? t("forgotPassword.sendingResetLink")
                        : t("forgotPassword.sendResetLink")}
                    </Button>
                  )}
                </form.Subscribe>
              </Field>
              <div className="text-center text-sm">
                <Link to="/auth/sign-in">{t("forgotPassword.backToSignIn")}</Link>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
