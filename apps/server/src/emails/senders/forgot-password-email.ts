import { resolveCommonConfig } from "@repo/app-config/config";
import { defaultLocale, type Locale } from "@repo/i18n";
import { createT } from "@/i18n";
import ForgotPasswordEmail from "../templates/forgot-password-email";
import { sendEmail, withLocale } from "./send-email";

export async function sendResetPasswordEmail({
  to,
  name,
  resetUrl,
  locale = defaultLocale,
}: {
  to: string;
  name: string;
  resetUrl: string;
  locale?: Locale;
}) {
  const t = createT(locale);
  const appName = resolveCommonConfig().app.name;

  await sendEmail({
    to,
    subject: t("email.passwordReset.subject", { appName }),
    template: ForgotPasswordEmail({ name, resetUrl, appName, locale }),
  });
}

export function sendResetPasswordEmailFromRequest(request?: Request) {
  return withLocale(request, sendResetPasswordEmail);
}
