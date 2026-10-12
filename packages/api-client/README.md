# @repo/api-client

Shared oRPC client helpers used by the web app.

```ts
import { createApiClient, createOrpcUtils, createQueryClient } from "@repo/api-client";
import type { AppRouterClient } from "@server/routers";

export const queryClient = createQueryClient();
export const client = createApiClient<AppRouterClient>({
  baseUrl: import.meta.env.VITE_SERVER_URL,
  credentials: "include",
});
export const orpc = createOrpcUtils(client);
```
