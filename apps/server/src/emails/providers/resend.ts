import { env } from "cloudflare:workers";
import { render } from "@react-email/render";
import { type CreateEmailOptions, Resend } from "resend";
import type { EmailProvider, SendEmailParams } from "../types";

/**
 * Resend email provider factory
 */
export function createResendEmailProvider({
  defaultFrom,
}: {
  defaultFrom?: string;
}): EmailProvider {
  const resolvedKey = env.RESEND_API_KEY;
  const client = resolvedKey ? new Resend(resolvedKey) : null;

  return {
    key: "resend",
    async send({ from, to, subject, html, text, template }: SendEmailParams) {
      if (!client) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const resolvedFrom = from ?? defaultFrom;
      if (!resolvedFrom) {
        throw new Error("Email service is not configured with a from address");
      }

      const renderedHtml = template ? await render(template) : html;
      if (!renderedHtml && !text) {
        throw new Error("Email content is missing");
      }

      const base = { from: resolvedFrom, to, subject };

      const payload: CreateEmailOptions = renderedHtml
        ? ({ ...base, html: renderedHtml } as CreateEmailOptions)
        : ({ ...base, text: text ?? "" } as CreateEmailOptions);

      const { error } = await client.emails.send(payload);

      if (error) {
        console.error("Failed to send email via Resend:", error);
        throw new Error(error.message);
      }
    },
  };
}
