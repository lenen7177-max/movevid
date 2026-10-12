import { createAuthClient } from "better-auth/react";
import { getCurrentLocale } from "@/i18n";
import { applyWebClientHeaders } from "@/lib/device-id";
import { emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL,
  plugins: [emailOTPClient(), phoneNumberClient()],
  fetchOptions: {
    credentials: "include",
    onRequest: (context) => {
      const headers = new Headers(context.headers ?? {});
      headers.set("accept-language", getCurrentLocale());
      applyWebClientHeaders(headers);
      return { ...context, headers };
    },
  },
});
