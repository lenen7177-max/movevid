import type { ReactElement } from "react";
import type { EmailProviderKey } from "@repo/app-config";

export type EmailRecipient = string | string[];

export type { EmailProviderKey } from "@repo/app-config";

export type SendEmailParams = {
  from?: string;
  to: EmailRecipient;
  /** Where replies go, e.g. the site's support address. */
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  template?: ReactElement;
};

export type EmailProvider = {
  key: EmailProviderKey;
  send(params: SendEmailParams): Promise<void>;
};
