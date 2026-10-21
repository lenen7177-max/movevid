import { resolveCommonConfig } from "@repo/app-config/config";
import { defaultLocale, type Locale } from "@repo/i18n";
import { createT } from "@/i18n";
import VideoReadyEmail, { videoReadyEmailText } from "../templates/video-ready-email";
import { sendEmail } from "./send-email";

/** "Your video is ready", with replies going to the site's support address. */
export async function sendVideoReadyEmail({
  to,
  name,
  videoUrl,
  locale = defaultLocale,
}: {
  to: string;
  name: string;
  videoUrl: string;
  locale?: Locale;
}) {
  const t = createT(locale);
  const { name: appName, supportEmail } = resolveCommonConfig().app;
  const props = { name, videoUrl, appName, locale };

  await sendEmail({
    to,
    subject: t("email.videoReady.subject", { appName }),
    template: VideoReadyEmail(props),
    text: videoReadyEmailText(props),
    replyTo: supportEmail?.trim() || undefined,
  });
}
