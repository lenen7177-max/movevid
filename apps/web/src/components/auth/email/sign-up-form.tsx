import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { FaGithub, FaGoogle } from "react-icons/fa";
import { toast } from "sonner";
import z from "zod";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { getAuthUrls, webConfig } from "@/configs/web-config";
import { useSocialSignIn } from "@/hooks/use-social-sign-in";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import { TermsAgreement } from "../terms-agreement";

const hasSocialSignUpMethods =
  webConfig.auth.methods.githubEnabled || webConfig.auth.methods.googleEnabled;

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const t = useTranslations();
  const { signIn: socialSignIn, loading: socialLoading } = useSocialSignIn();
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      const authUrls = getAuthUrls();
      await authClient.signUp.email(
        {
          name: value.name,
          email: value.email,
          password: value.password,
          callbackURL: authUrls.callbackURL,
        },
        {
          onRequest: () => {},
          onResponse: () => {},
          onSuccess: () => {
            setVerificationEmail(value.email);
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
          name: z.string().min(2, t("auth.validation.nameMinLength")),
          email: z.email(t("auth.validation.invalidEmail")),
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
    <div className={cn("flex w-full max-w-md flex-col gap-4", className)} {...props}>
      <Dialog
        open={verificationEmail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVerificationEmail(null);
          }
        }}
      >
        <DialogContent className="border-primary/20 sm:max-w-md">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="bg-primary/10 text-primary mb-1 flex size-14 items-center justify-center rounded-full">
              <MailCheckIcon className="size-7" />
            </div>
            <DialogTitle className="text-xl">{t("signUp.checkEmailTitle")}</DialogTitle>
            <DialogDescription className="text-balance">
              {t("signUp.checkEmailDescription", { email: verificationEmail ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <p className="bg-muted text-muted-foreground rounded-md px-4 py-3 text-center text-sm">
            {t("signUp.checkEmailHint")}
          </p>
          <DialogFooter>
            <DialogClose render={<Button type="button" className="w-full" />}>
              {t("signUp.checkEmailAction")}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="overflow-hidden p-0">
        <CardContent>
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t("signUp.title")}</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  {t("signUp.description")}
                </p>
              </div>
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>{t("signUp.name")}</FieldLabel>
                      <Input
                        id={field.name}
                        type="text"
                        placeholder={t("signUp.enterName")}
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
                      <FieldDescription>{t("signUp.emailDescription")}</FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <Field className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field
                  name="password"
                  children={(field) => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{t("auth.password")}</FieldLabel>
                        <PasswordInput
                          id={field.name}
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
                        <FieldLabel htmlFor={field.name}>{t("signUp.confirmPassword")}</FieldLabel>
                        <PasswordInput
                          id={field.name}
                          placeholder={t("signUp.confirmYourPassword")}
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
              </Field>
              <FieldDescription>{t("signUp.passwordMinLength")}</FieldDescription>
              <Field>
                <form.Subscribe>
                  {(state) => (
                    <Button
                      type="submit"
                      className="w-full cursor-pointer"
                      disabled={!state.canSubmit || state.isSubmitting || socialLoading !== null}
                    >
                      {state.isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                      {t("signUp.createAccount")}
                    </Button>
                  )}
                </form.Subscribe>
              </Field>
              {hasSocialSignUpMethods ? (
                <>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    {t("auth.orContinueWith")}
                  </FieldSeparator>
                  <Field
                    className={cn(
                      "grid gap-4",
                      webConfig.auth.methods.githubEnabled &&
                        webConfig.auth.methods.googleEnabled &&
                        "grid-cols-2",
                    )}
                  >
                    {webConfig.auth.methods.githubEnabled ? (
                      <Button
                        variant="outline"
                        type="button"
                        disabled={socialLoading !== null}
                        onClick={() => socialSignIn("github")}
                      >
                        {socialLoading === "github" && (
                          <Loader2Icon className="size-4 animate-spin" />
                        )}
                        <FaGithub className="mr-2" />
                        Github
                      </Button>
                    ) : null}
                    {webConfig.auth.methods.googleEnabled ? (
                      <Button
                        variant="outline"
                        type="button"
                        disabled={socialLoading !== null}
                        onClick={() => socialSignIn("google")}
                      >
                        {socialLoading === "google" && (
                          <Loader2Icon className="size-4 animate-spin" />
                        )}
                        <FaGoogle className="mr-2" />
                        Google
                      </Button>
                    ) : null}
                  </Field>
                </>
              ) : null}
              <FieldDescription className="text-center">
                {t("signUp.hasAccount")} <Link to="/auth/sign-in">{t("signUp.signIn")}</Link>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <TermsAgreement />
    </div>
  );
}
