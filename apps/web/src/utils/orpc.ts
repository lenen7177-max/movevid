import {
  createApiClient,
  createOrpcUtils,
  getOrpcErrorCode,
  getOrpcErrorReason,
} from "@repo/api-client";
import type { AppRouterClient } from "@server/routers";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCurrentLocale, getMessages } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { applyWebClientHeaders } from "@/lib/device-id";
import { invalidateAppRoute } from "@/utils/app-router";

const DEFAULT_STALE_TIME_MS = 60_000;

function handleForbiddenError(error: Error): boolean {
  if (getOrpcErrorCode(error) !== "FORBIDDEN") {
    return false;
  }

  const locale = getCurrentLocale();
  const messages = getMessages(locale);

  if (getOrpcErrorReason(error) === "ACCOUNT_BANNED") {
    const banMessage = messages.errors?.accountBanned ?? error.message;
    toast.error(banMessage);
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/auth/sign-in");
        },
      },
    });
    return true;
  }

  toast.error(messages.errors?.forbidden ?? error.message);
  void invalidateAppRoute();
  return true;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (handleForbiddenError(error)) return;

      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Error: ${message}`, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      handleForbiddenError(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
    },
  },
});

// Get service binding if available (server-side only)
function getServiceBinding() {
  if (typeof window !== "undefined") return undefined;
  return typeof API_SERVICE === "undefined" ? undefined : API_SERVICE;
}

export const client = createApiClient<AppRouterClient>({
  baseUrl: import.meta.env.VITE_SERVER_URL,
  credentials: "include",
  serviceBinding: getServiceBinding(),
  getHeaders: () => applyWebClientHeaders(new Headers()),
});

export const orpc = createOrpcUtils<AppRouterClient>(client);
