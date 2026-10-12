import {
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { defaultLocale, type Locale } from "@repo/i18n";
import { createT } from "@/i18n";

type EmailOtpEmailProps = {
  appName: string;
  expiresInMinutes: number;
  locale: Locale;
  otp: string;
};

export const PreviewProps: EmailOtpEmailProps = {
  appName: "YourBrand",
  expiresInMinutes: 5,
  locale: defaultLocale,
  otp: "123456",
};

export default function EmailOtpEmail({
  appName,
  expiresInMinutes,
  locale,
  otp,
}: EmailOtpEmailProps) {
  const t = createT(locale);

  return (
    <Html>
      <Head />
      <Preview>{t("email.otp.preview", { appName })}</Preview>
      <Tailwind>
        <Section className="bg-gray-100 py-10">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-10">
            <Heading className="m-0 mb-5 text-2xl font-semibold text-gray-900">
              {t("email.otp.title")}
            </Heading>
            <Text className="mb-4 text-base text-gray-600">{t("email.otp.body", { appName })}</Text>
            <Section className="my-6 rounded-lg bg-gray-100 px-6 py-5 text-center">
              <Text className="m-0 text-3xl font-bold text-gray-900">{otp}</Text>
            </Section>
            <Text className="mb-4 text-base text-gray-600">
              {t("email.otp.expires", { minutes: expiresInMinutes })}
            </Text>
            <Text className="mb-4 text-base text-gray-600">{t("email.otp.ignore")}</Text>
            <Hr className="my-8 border-gray-200" />
            <Text className="m-0 text-xs text-gray-400">
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Container>
        </Section>
      </Tailwind>
    </Html>
  );
}
