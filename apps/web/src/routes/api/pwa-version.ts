import { createFileRoute } from "@tanstack/react-router";

declare const __PWA_BUILD_ID__: string;

export const Route = createFileRoute("/api/pwa-version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { buildId: __PWA_BUILD_ID__ },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        ),
    },
  },
});
