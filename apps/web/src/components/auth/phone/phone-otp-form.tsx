import { useEffect, useState } from "react";
import { computeOtpRemainingSeconds } from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { Button, buttonVariants } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { webConfig } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

type PhoneOtpFormProps = React.ComponentProps<"div"> & {
  phoneNumber: string;
};

const smsOtpConfig = webConfig.auth.otp.sms;

export function PhoneOtpForm({ phoneNumber, className, ...props }: PhoneOtpFormProps) {
  const t = useTranslations();
  const navigate = useNavigate();
  const [resendDeadline, setResendDeadline] = useState(
    () => Date.now() + smsOtpConfig.resendCooldownSeconds * 1000,
  );
  const [resendCountdown, setResendCountdown] = useState(() =>
    computeOtpRemainingSeconds(resendDeadline),
  );

  // Single interval keyed by the deadline. It stops itself once the countdown hits zero and
  // only restarts when handleResend bumps the deadline, avoiding an interval-per-tick churn.
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
    validators: {
      onSubmit: z.object({
        code: z
          .string()
          .length(smsOtpConfig.otpLength, t("auth.validation.invalidVerificationCode")),
      }),
    },
    onSubmit: async ({ value }) => {
      await authClient.phoneNumber.verify(
        {
          phoneNumber,
          code: value.code,
        },
        {
          onSuccess: () => {
            toast.success(t("signIn.success"));
            navigate({ to: "/" });
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
  });

  async function handleResend() {
    await authClient.phoneNumber.sendOtp(
      { phoneNumber },
      {
        onSuccess: () => {
          const nextDeadline = Date.now() + smsOtpConfig.resendCooldownSeconds * 1000;
          setResendDeadline(nextDeadline);
          setResendCountdown(computeOtpRemainingSeconds(nextDeadline));
          toast.success(t("auth.phoneCodeSent", { phoneNumber }));
        },
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
  }

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-4", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("auth.verificationCode")}</CardTitle>
          <CardDescription>{t("signIn.phoneOtpDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
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
                      <Input
                        id={field.name}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder={t("auth.enterVerificationCode")}
                        aria-invalid={isInvalid}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      <FieldDescription>
                        {t("auth.phoneOtpSentDescription", { phoneNumber })}
                      </FieldDescription>
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              />
              <form.Subscribe>
                {(state) => {
                  const busy = state.isSubmitting;
                  return (
                    <Button type="submit" className="w-full" disabled={!state.canSubmit || busy}>
                      {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
                      {busy ? t("auth.verifyingCode") : t("auth.verifyCode")}
                    </Button>
                  );
                }}
              </form.Subscribe>
              <div className="flex gap-2">
                <Link
                  className={buttonVariants({ variant: "outline", className: "flex-1" })}
                  to="/auth/sign-in"
                  search={{ method: "phone" }}
                >
                  {t("auth.changePhoneNumber")}
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={resendCountdown > 0}
                  onClick={() => {
                    handleResend();
                  }}
                >
                  {resendCountdown > 0
                    ? t("auth.resendCodeIn", { seconds: resendCountdown })
                    : t("auth.resendCode")}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
