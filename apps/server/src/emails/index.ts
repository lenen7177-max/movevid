export { withLocale } from "./locale";

import { resolveCommonConfig } from "@repo/app-config/config";
import { createCloudflareEmailProvider } from "./providers/cloudflare";
import { createResendEmailProvider } from "./providers/resend";
import type { EmailProvider, EmailProviderKey } from "./types";

export {
  sendResetPasswordEmail,
  sendResetPasswordEmailFromRequest,
} from "./senders/forgot-password-email";
export {
  sendVerificationEmail,
  sendVerificationEmailFromRequest,
} from "./senders/sign-up-verify-email";
export { sendSignInOtpEmail, sendSignInOtpEmailFromRequest } from "./senders/email-otp-email";
export type { EmailProvider, SendEmailParams } from "./types";

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const commonConfig = resolveCommonConfig();
  if (!commonConfig?.app || !commonConfig?.email) {
    throw new Error("Invalid app config: missing common app/email settings");
  }

  const providerKey: EmailProviderKey = commonConfig.email.provider ?? "resend";
  const fromEmail = `${commonConfig.email.from.localPart}@${commonConfig.email.from.domain}`;

  const providers: Record<EmailProviderKey, EmailProvider> = {
    resend: createResendEmailProvider({
      defaultFrom: `${commonConfig.app.name} <${fromEmail}>`,
    }),
    cloudflare: createCloudflareEmailProvider({
      defaultFrom: {
        email: fromEmail,
        name: commonConfig.app.name,
      },
    }),
  };

  const provider = providers[providerKey];
  if (!provider) {
    throw new Error(`Email provider not registered: ${providerKey}`);
  }

  cachedProvider = provider;
  return provider;
}
