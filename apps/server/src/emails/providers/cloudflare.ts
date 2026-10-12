import { env } from "cloudflare:workers";
import { render } from "@react-email/render";
import type { EmailProvider, SendEmailParams } from "../types";

type DefaultFrom = {
  email: string;
  name: string;
};

export function createCloudflareEmailProvider({
  defaultFrom,
}: {
  defaultFrom?: DefaultFrom;
}): EmailProvider {
  return {
    key: "cloudflare",
    async send({ from, to, subject, html, text, template }: SendEmailParams) {
      const resolvedFrom = from ?? defaultFrom;
      if (!resolvedFrom) {
        throw new Error("Email service is not configured with a from address");
      }

      const renderedHtml = template ? await render(template) : html;
      if (!renderedHtml && !text) {
        throw new Error("Email content is missing");
      }

      try {
        await env.EMAIL.send({
          from: resolvedFrom,
          to,
          subject,
          ...(renderedHtml ? { html: renderedHtml } : {}),
          ...(text ? { text } : {}),
        });
      } catch (error) {
        const code = error instanceof Error && "code" in error ? error.code : undefined;
        console.error("Failed to send email via Cloudflare Email Service:", { code, error });
        throw error;
      }
    },
  };
}
