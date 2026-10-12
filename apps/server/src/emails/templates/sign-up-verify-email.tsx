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

type SignUpVerifyEmailProps = {
  name: string;
  verificationUrl: string;
  appName: string;
  locale: Locale;
};

export const PreviewProps: SignUpVerifyEmailProps = {
  name: "Jamie",
  verificationUrl: "https://example.com/verify",
  appName: "YourBrand",
  locale: defaultLocale,
};

export default function SignUpVerifyEmail({
  name,
  verificationUrl,
  appName,
  locale,
}: SignUpVerifyEmailProps) {
  const t = createT(locale);

  return (
    <Html>
      <Head />
      <Preview>{t("email.verification.preview", { appName })}</Preview>
      <Tailwind>
        <Section className="bg-gray-100 py-10">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-10">
            <Heading className="m-0 mb-5 text-2xl font-semibold text-gray-900">
              {t("email.verification.title")}
            </Heading>
            <Text className="mb-4 text-base text-gray-600">
              {t("email.verification.greeting", { name })}
            </Text>
            <Text className="mb-4 text-base text-gray-600">{t("email.verification.body")}</Text>
            <Section className="my-6">
              <Button
                href={verificationUrl}
                className="rounded-md bg-black px-6 py-3 text-base font-semibold text-white"
              >
                {t("email.verification.button")}
              </Button>
            </Section>
            <Text className="mb-4 text-base text-gray-600">{t("email.verification.ignore")}</Text>
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
