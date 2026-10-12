import { resolveCommonConfig } from "@repo/app-config/config";
import { defaultLocale, type Locale } from "@repo/i18n";
import { createT } from "@/i18n";
import SignUpVerifyEmail from "../templates/sign-up-verify-email";
import { sendEmail, withLocale } from "./send-email";

export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
  locale = defaultLocale,
}: {
  to: string;
  name: string;
  verificationUrl: string;
  locale?: Locale;
}) {
  const t = createT(locale);
  const appName = resolveCommonConfig().app.name;

  await sendEmail({
    to,
    subject: t("email.verification.subject", { appName }),
    template: SignUpVerifyEmail({ name, verificationUrl, appName, locale }),
  });
}

export function sendVerificationEmailFromRequest(request?: Request) {
  return withLocale(request, sendVerificationEmail);
}
