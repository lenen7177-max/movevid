import { CN_PHONE_NUMBER_REGEX } from "@repo/shared";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { PhoneOtpForm } from "@/components/auth/phone/phone-otp-form";
import { webConfig } from "@/configs/web-config";

const searchSchema = z.object({
  phoneNumber: z.string().optional(),
});

export const Route = createFileRoute("/(auth)/auth/_unauthed/phone-verify")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (
      !webConfig.auth.methods.smsEnabled ||
      !search.phoneNumber ||
      !CN_PHONE_NUMBER_REGEX.test(search.phoneNumber)
    ) {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  // phoneNumber presence is guaranteed by beforeLoad.
  const { phoneNumber } = Route.useSearch() as { phoneNumber: string };
  return <PhoneOtpForm phoneNumber={phoneNumber} />;
}
