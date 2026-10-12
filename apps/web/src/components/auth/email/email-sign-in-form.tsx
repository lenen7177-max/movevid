import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@repo/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { getAuthUrls } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { TurnstileWidget } from "../turnstile-widget";
import { EmailOtpVerifyForm } from "./email-otp-verify-form";

export type EmailSignInMode = "password" | "otp";

type EmailSignInFormProps = {
  mode: EmailSignInMode;
  onOtpVerificationChange?: (isVerifying: boolean) => void;
  /** Runs after a code sign-in succeeds. */
  onSignedIn?: () => void;
};

export function EmailSignInForm({
  mode,
  onOtpVerificationChange,
  onSignedIn,
}: EmailSignInFormProps) {
  const t = useTranslations();
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  const passwordForm = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const authUrls = getAuthUrls();
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
          callbackURL: authUrls.callbackURL,
        },
        {
          onSuccess: () => {
            toast.success(t("signIn.success"));
          },
          onError: (error) => {
            toast.error(
              error.error.code === "BANNED_USER"
                ? t("errors.accountBanned")
                : error.error.message || error.error.statusText,
            );
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email(t("auth.validation.invalidEmail")),
        password: z.string().min(1, t("auth.validation.passwordRequired")),
      }),
    },
  });

  const otpRequestForm = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      const email = value.email.trim().toLowerCase();
      await authClient.emailOtp.sendVerificationOtp(
        {
          email,
          type: "sign-in",
        },
        {
          headers: { "x-captcha-response": captchaToken ?? "" },
          onSuccess: () => {
            setOtpEmail(email);
            toast.success(t("auth.emailCodeSent", { email }));
          },
          onError: (error) => {
            setCaptchaResetSignal((count) => count + 1);
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

  useEffect(() => {
    onOtpVerificationChange?.(mode === "otp" && otpEmail !== null);
  }, [mode, onOtpVerificationChange, otpEmail]);

  if (mode === "password") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          passwordForm.handleSubmit();
        }}
      >
        <FieldGroup>
          <passwordForm.Field
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
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <passwordForm.Field
            name="password"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <div className="flex items-center">
                    <FieldLabel htmlFor={field.name}>{t("auth.password")}</FieldLabel>
                    <Link
                      to="/auth/forgot-password"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      {t("signIn.forgotPassword")}
                    </Link>
                  </div>
                  <PasswordInput
                    id={field.name}
                    placeholder={t("auth.enterPassword")}
                    value={field.state.value}
                    aria-invalid={isInvalid}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <Field>
            <passwordForm.Subscribe>
              {(state) => (
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  disabled={!state.canSubmit || state.isSubmitting}
                >
                  {state.isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                  {state.isSubmitting ? t("signIn.loggingIn") : t("signIn.login")}
                </Button>
              )}
            </passwordForm.Subscribe>
          </Field>
        </FieldGroup>
      </form>
    );
  }

  if (otpEmail) {
    return (
      <EmailOtpVerifyForm
        email={otpEmail}
        onChangeEmail={() => setOtpEmail(null)}
        onSignedIn={onSignedIn}
      />
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        otpRequestForm.handleSubmit();
      }}
    >
      <FieldGroup>
        <otpRequestForm.Field
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
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldDescription>{t("auth.emailOtpDescription")}</FieldDescription>
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        />
        <TurnstileWidget onTokenChange={setCaptchaToken} resetSignal={captchaResetSignal} />
        <otpRequestForm.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!captchaToken || !state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {state.isSubmitting ? t("auth.sendingCode") : t("auth.sendCode")}
            </Button>
          )}
        </otpRequestForm.Subscribe>
      </FieldGroup>
    </form>
  );
}
