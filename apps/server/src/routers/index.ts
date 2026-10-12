import type { RouterClient } from "@orpc/server";
import { publicProcedure } from "../lib/orpc";
import { creditsRouter } from "./common/credits";
import { storageRouter } from "./common/storage";
import { getCurrentUserFromContext, usersRouter } from "./common/users";
import { webCreditsRouter } from "./web/credits";
import { adminBillingRouter } from "./admin/billing";
import { adminOperationsRouter } from "./admin/operations";
import { videoRouter } from "./video";

/**
 * App Router - Platform-organized API routes
 *
 * Structure:
 * - Root level: Common APIs
 * - web: Web-specific APIs
 *
 * Note: File serving (GET /api/storage/*) uses HTTP for caching/CDN compatibility.
 */
const healthCheckProcedure = publicProcedure.handler(() => "OK");
const currentUserProcedure = publicProcedure.handler(({ context }) =>
  getCurrentUserFromContext(context),
);

type AppRouterDefinition = {
  healthCheck: typeof healthCheckProcedure;
  getCurrentUser: typeof currentUserProcedure;
  users: typeof usersRouter;
  storage: typeof storageRouter;
  credits: typeof creditsRouter;
  video: typeof videoRouter;
  admin: { billing: typeof adminBillingRouter; operations: typeof adminOperationsRouter };
  web: { credits: typeof webCreditsRouter };
};

export const appRouter: AppRouterDefinition = {
  // ============ Common APIs ============
  healthCheck: healthCheckProcedure,
  getCurrentUser: currentUserProcedure,
  users: usersRouter,
  storage: storageRouter,
  credits: creditsRouter,
  video: videoRouter,
  admin: {
    billing: adminBillingRouter,
    operations: adminOperationsRouter,
  },
  // ============ Web-specific APIs ============
  web: {
    credits: webCreditsRouter,
  },
};

/** Server-side oRPC router type. */
export type AppRouter = typeof appRouter;
/** Client type generated from the oRPC router. */
export type AppRouterClient = RouterClient<typeof appRouter>;
