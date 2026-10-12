import {
  Button,
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

type ForgotPasswordEmailProps = {
  name: string;
  resetUrl: string;
  appName: string;
  locale: Locale;
};

export const PreviewProps: ForgotPasswordEmailProps = {
  name: "Jamie",
  resetUrl: "https://example.com/reset",
  appName: "YourBrand",
  locale: defaultLocale,
};

export default function ForgotPasswordEmail({
  name,
  resetUrl,
  appName,
  locale,
}: ForgotPasswordEmailProps) {
  const t = createT(locale);

  return (
    <Html>
      <Head />
      <Preview>{t("email.passwordReset.subject", { appName })}</Preview>
      <Tailwind>
        <Section className="bg-gray-100 py-10">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-10">
            <Heading className="m-0 mb-5 text-2xl font-semibold text-gray-900">
              {t("email.passwordReset.title")}
            </Heading>
            <Text className="mb-4 text-base text-gray-600">
              {t("email.passwordReset.greeting", { name })}
            </Text>
            <Text className="mb-4 text-base text-gray-600">{t("email.passwordReset.body")}</Text>
            <Section className="my-6">
              <Button
                href={resetUrl}
                className="rounded-md bg-black px-6 py-3 text-base font-semibold text-white"
              >
                {t("email.passwordReset.button")}
              </Button>
            </Section>
            <Text className="mb-4 text-base text-gray-600">{t("email.passwordReset.ignore")}</Text>
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
