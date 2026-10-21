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
    async send({ from, to, subject, html, text, template, replyTo }: SendEmailParams) {
      const resolvedFrom = from ?? defaultFrom;
      if (!resolvedFrom) {
        throw new Error("Email service is not configured with a from address");
      }

      const renderedHtml = template ? await render(template) : html;
      if (!renderedHtml && !text) {
        throw new Error("Email content is missing");
      }

      // Declared in wrangler.jsonc only when site.config.jsonc sets emailProvider "cloudflare".
      const binding = (env as { EMAIL?: SendEmail }).EMAIL;
      if (!binding) {
        throw new Error(
          'The EMAIL send_email binding is missing: set emailProvider to "cloudflare" in site.config.jsonc and run `pnpm site:sync`',
        );
      }

      try {
        await binding.send({
          from: resolvedFrom,
          to,
          subject,
          ...(replyTo ? { replyTo } : {}),
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
