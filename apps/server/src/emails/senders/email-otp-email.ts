import { resolveCommonConfig } from "@repo/app-config/config";
import { defaultLocale, type Locale } from "@repo/i18n";
import { createT } from "@/i18n";
import EmailOtpEmail from "../templates/email-otp-email";
import { sendEmail, withLocale } from "./send-email";

export async function sendSignInOtpEmail({
  to,
  otp,
  locale = defaultLocale,
}: {
  to: string;
  otp: string;
  locale?: Locale;
}) {
  const t = createT(locale);
  const commonConfig = resolveCommonConfig();
  const appName = commonConfig.app.name;
  const expiresInMinutes = Math.ceil(commonConfig.auth.otp.email.expiresInSeconds / 60);

  await sendEmail({
    to,
    subject: t("email.otp.subject", { appName }),
    template: EmailOtpEmail({
      appName,
      expiresInMinutes,
      locale,
      otp,
    }),
  });
}

export function sendSignInOtpEmailFromRequest(request?: Request) {
  return withLocale(request, sendSignInOtpEmail);
}
