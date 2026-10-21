import type { ReactElement } from "react";
import { getEmailProvider } from "..";
import { withLocale } from "../locale";

const emailProvider = getEmailProvider();

export async function sendEmail({
  to,
  subject,
  template,
  from,
  text,
  replyTo,
}: {
  to: string;
  subject: string;
  template: ReactElement;
  from?: string;
  text?: string;
  replyTo?: string;
}) {
  await emailProvider.send({
    to,
    subject,
    template,
    from,
    text,
    replyTo,
  });
}

export { withLocale };
