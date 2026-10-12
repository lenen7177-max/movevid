import { createApiClient } from "@repo/api-client";
import { CLIENT_DEVICE_ID_HEADER, CLIENT_PLATFORM_HEADER } from "@repo/shared";
import type { AppRouterClient } from "@server/routers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readDeviceIdFromCookieHeader } from "@/lib/device-id";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function createServerClient(cookie: string, deviceId: string | null) {
  return createApiClient<AppRouterClient>({
    baseUrl: SERVER_URL,
    getHeaders: () => {
      const headers = new Headers();
      if (cookie) headers.set("cookie", cookie);
      if (deviceId) {
        headers.set(CLIENT_DEVICE_ID_HEADER, deviceId);
        headers.set(CLIENT_PLATFORM_HEADER, "web");
      }
      return headers;
    },
    serviceBinding: typeof API_SERVICE === "undefined" ? undefined : API_SERVICE,
  });
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const cookie = request?.headers.get("cookie") ?? "";
  const client = createServerClient(cookie, readDeviceIdFromCookieHeader(cookie));
  return client.getCurrentUser();
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
