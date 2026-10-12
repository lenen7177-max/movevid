import {
  CN_DIAL_PREFIX,
  CN_LOCAL_PHONE_DIGITS,
  CN_PHONE_NUMBER_REGEX,
  toCnE164PhoneNumber,
} from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@repo/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

export function PhoneSignInForm() {
  const t = useTranslations();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      localDigits: "",
    },
    validators: {
      onSubmit: z.object({
        localDigits: z
          .string()
          .length(CN_LOCAL_PHONE_DIGITS, t("auth.validation.invalidPhone"))
          .regex(/^\d+$/, t("auth.validation.invalidPhone"))
          .refine(
            (digits) => CN_PHONE_NUMBER_REGEX.test(toCnE164PhoneNumber(digits)),
            t("auth.validation.invalidPhone"),
          ),
      }),
    },
    onSubmit: async ({ value }) => {
      const phoneNumber = toCnE164PhoneNumber(value.localDigits);
      await authClient.phoneNumber.sendOtp(
        { phoneNumber },
        {
          onSuccess: () => {
            toast.success(t("auth.phoneCodeSent", { phoneNumber }));
            navigate({ to: "/auth/phone-verify", search: { phoneNumber } });
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
  });

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
          name="localDigits"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>{t("auth.phoneNumber")}</FieldLabel>
                <div
                  className={cn(
                    "flex h-9 items-stretch rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
                    isInvalid && "border-destructive ring-destructive/20 dark:ring-destructive/40",
                  )}
                >
                  <span className="flex select-none items-center border-r border-input px-3 text-sm text-muted-foreground">
                    {CN_DIAL_PREFIX}
                  </span>
                  <Input
                    id={field.name}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={CN_LOCAL_PHONE_DIGITS}
                    placeholder={t("auth.enterPhoneNumber")}
                    aria-invalid={isInvalid}
                    className="h-full border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value.replace(/\D/g, "").slice(0, CN_LOCAL_PHONE_DIGITS),
                      )
                    }
                  />
                </div>
                <FieldDescription>{t("auth.phoneNumberDescription")}</FieldDescription>
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
              {state.isSubmitting ? t("auth.sendingCode") : t("auth.sendCode")}
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  );
}
