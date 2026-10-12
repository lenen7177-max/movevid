import { useState } from "react";
import { toast } from "sonner";
import { getAuthUrls } from "@/configs/web-config";
import { authClient } from "@/lib/auth/auth-client";

type SocialProvider = "github" | "google";

// Return to the page the user signed in from; sign-in pages fall back to the default callback.
const AUTH_PAGE_PATTERN = /^(\/[a-z]{2})?\/auth(\/|$)/;

function resolveCallbackURL(defaultURL: string): string {
  if (typeof window === "undefined") return defaultURL;
  if (AUTH_PAGE_PATTERN.test(window.location.pathname)) return defaultURL;
  return window.location.href;
}

export function useSocialSignIn() {
  const [loading, setLoading] = useState<SocialProvider | null>(null);

  const signIn = (provider: SocialProvider) => {
    const authUrls = getAuthUrls();
    return authClient.signIn.social(
      {
        provider,
        callbackURL: resolveCallbackURL(authUrls.callbackURL),
        errorCallbackURL: authUrls.errorCallbackURL,
      },
      {
        onRequest: () => setLoading(provider),
        onError: (error) => {
          setLoading(null);
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
  };

  return { signIn, loading };
}
