import { useEffect, useState } from "react";
import { buildDefaultEmailUserName, computeOtpRemainingSeconds } from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@repo/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@repo/ui/input-otp";
import { webConfig } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { TurnstileWidget } from "../turnstile-widget";

type EmailOtpVerifyFormProps = {
  email: string;
  onChangeEmail: () => void;
  /** Runs after sign-in succeeds; defaults to going home. */
  onSignedIn?: () => void;
};

const emailOtpConfig = webConfig.auth.otp.email;
const emailOtpSlotIndexes = Array.from({ length: emailOtpConfig.otpLength }, (_, index) => index);
const emailOtpSplitIndex = Math.ceil(emailOtpSlotIndexes.length / 2);
const emailOtpPrimarySlotIndexes = emailOtpSlotIndexes.slice(0, emailOtpSplitIndex);
const emailOtpSecondarySlotIndexes = emailOtpSlotIndexes.slice(emailOtpSplitIndex);

export function EmailOtpVerifyForm({ email, onChangeEmail, onSignedIn }: EmailOtpVerifyFormProps) {
  const t = useTranslations();
  const navigate = useNavigate();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [resendDeadline, setResendDeadline] = useState(
    () => Date.now() + emailOtpConfig.resendCooldownSeconds * 1000,
  );
  const [resendCountdown, setResendCountdown] = useState(() =>
    computeOtpRemainingSeconds(resendDeadline),
  );

  useEffect(() => {
    if (resendDeadline <= Date.now()) return;

    const timer = window.setInterval(() => {
      const remaining = computeOtpRemainingSeconds(resendDeadline);
      setResendCountdown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendDeadline]);

  const form = useForm({
    defaultValues: {
      code: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.emailOtp(
        {
          email,
          name: buildDefaultEmailUserName(email),
          otp: value.code,
        },
        {
          onSuccess: () => {
            toast.success(t("signIn.success"));
            if (onSignedIn) onSignedIn();
            else navigate({ to: "/" });
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        code: z
          .string()
          .length(emailOtpConfig.otpLength, t("auth.validation.invalidVerificationCode")),
      }),
    },
  });

  async function handleResendEmailOtp() {
    await authClient.emailOtp.sendVerificationOtp(
      {
        email,
        type: "sign-in",
      },
      {
        headers: { "x-captcha-response": captchaToken ?? "" },
        onSuccess: () => {
          // The widget unmounts during the cooldown; this token is spent.
          setCaptchaToken(null);
          const nextDeadline = Date.now() + emailOtpConfig.resendCooldownSeconds * 1000;
          setResendDeadline(nextDeadline);
          setResendCountdown(computeOtpRemainingSeconds(nextDeadline));
          toast.success(t("auth.emailCodeSent", { email }));
        },
        onError: (error) => {
          setCaptchaResetSignal((count) => count + 1);
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="code"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>{t("auth.verificationCode")}</FieldLabel>
                <InputOTP
                  id={field.name}
                  value={field.state.value}
                  maxLength={emailOtpConfig.otpLength}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-invalid={isInvalid}
                  containerClassName="justify-center"
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                >
                  <InputOTPGroup>
                    {emailOtpPrimarySlotIndexes.map((index) => (
                      <InputOTPSlot key={index} index={index} aria-invalid={isInvalid} />
                    ))}
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    {emailOtpSecondarySlotIndexes.map((index) => (
                      <InputOTPSlot key={index} index={index} aria-invalid={isInvalid} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription>{t("auth.emailOtpSentDescription", { email })}</FieldDescription>
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        />
        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {state.isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCode")}
            </Button>
          )}
        </form.Subscribe>
        {resendCountdown <= 0 ? (
          <TurnstileWidget onTokenChange={setCaptchaToken} resetSignal={captchaResetSignal} />
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onChangeEmail}>
            {t("auth.changeEmail")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={resendCountdown > 0 || !captchaToken}
            onClick={() => {
              handleResendEmailOtp();
            }}
          >
            {resendCountdown > 0
              ? t("auth.resendCodeIn", { seconds: resendCountdown })
              : t("auth.resendCode")}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
