import {
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { defaultLocale, type Locale } from "@repo/i18n";
import { createT } from "@/i18n";

type VideoReadyEmailProps = {
  name: string;
  videoUrl: string;
  appName: string;
  locale: Locale;
};

export const PreviewProps: VideoReadyEmailProps = {
  name: "Jamie",
  videoUrl: "https://example.com/studio?job=123",
  appName: "YourBrand",
  locale: defaultLocale,
};

/** Sent once when a render succeeds. Copy lives in the server messages under email.videoReady. */
export default function VideoReadyEmail({ name, videoUrl, appName, locale }: VideoReadyEmailProps) {
  const t = createT(locale);

  return (
    <Html>
      <Head />
      <Preview>{t("email.videoReady.preview")}</Preview>
      <Tailwind>
        <Section className="bg-gray-100 py-10">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-10">
            <Heading className="m-0 mb-5 text-2xl font-semibold text-gray-900">
              {t("email.videoReady.title")}
            </Heading>
            <Text className="mb-4 text-base text-gray-600">
              {t("email.videoReady.greeting", { name })}
            </Text>
            <Text className="mb-4 text-base text-gray-600">{t("email.videoReady.body")}</Text>
            <Section className="my-6">
              <Button
                href={videoUrl}
                className="rounded-md bg-black px-6 py-3 text-base font-semibold text-white"
              >
                {t("email.videoReady.button")}
              </Button>
            </Section>
            <Text className="mb-4 text-sm break-all text-gray-500">
              {t("email.videoReady.linkFallback")}{" "}
              <Link href={videoUrl} className="text-gray-700 underline">
                {videoUrl}
              </Link>
            </Text>
            <Heading as="h2" className="m-0 mt-6 mb-2 text-lg font-semibold text-gray-900">
              {t("email.videoReady.downloadTitle")}
            </Heading>
            <Text className="mb-4 text-base text-gray-600">{t("email.videoReady.download")}</Text>
            <Heading as="h2" className="m-0 mt-6 mb-2 text-lg font-semibold text-gray-900">
              {t("email.videoReady.tiktokTitle")}
            </Heading>
            <Text className="mb-4 text-base text-gray-600">{t("email.videoReady.tiktok")}</Text>
            <Text className="mb-4 text-base text-gray-600">{t("email.videoReady.reply")}</Text>
            <Text className="mb-4 text-sm text-gray-500">{t("email.videoReady.signIn")}</Text>
            <Hr className="my-8 border-gray-200" />
            <Text className="m-0 text-xs text-gray-400">
              {t("email.videoReady.footer", { appName })}
            </Text>
          </Container>
        </Section>
      </Tailwind>
    </Html>
  );
}

/** Plain-text part, same copy as the HTML template. */
export function videoReadyEmailText({
  name,
  videoUrl,
  appName,
  locale,
}: VideoReadyEmailProps): string {
  const t = createT(locale);
  return [
    t("email.videoReady.greeting", { name }),
    t("email.videoReady.body"),
    `${t("email.videoReady.button")}: ${videoUrl}`,
    `${t("email.videoReady.downloadTitle")}: ${t("email.videoReady.download")}`,
    `${t("email.videoReady.tiktokTitle")}: ${t("email.videoReady.tiktok")}`,
    t("email.videoReady.reply"),
    t("email.videoReady.signIn"),
    "",
    t("email.videoReady.footer", { appName }),
  ].join("\n\n");
}
