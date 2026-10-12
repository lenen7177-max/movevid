import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../lib/orpc";
import { creditsRouter } from "./common/credits";
import { commonPaymentsRouter } from "./common/payments";
import { storageRouter } from "./common/storage";
import { getCurrentUserFromContext, usersRouter } from "./common/users";
import { webCreditsRouter } from "./web/credits";
import { paymentsRouter } from "./web/payments";
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
const privateDataProcedure = protectedProcedure.handler(({ context }) => ({
  message: "This is private",
  user: context.session?.user,
}));

type AppRouterDefinition = {
  healthCheck: typeof healthCheckProcedure;
  getCurrentUser: typeof currentUserProcedure;
  privateData: typeof privateDataProcedure;
  users: typeof usersRouter;
  storage: typeof storageRouter;
  payments: typeof commonPaymentsRouter;
  credits: typeof creditsRouter;
  video: typeof videoRouter;
  admin: { billing: typeof adminBillingRouter; operations: typeof adminOperationsRouter };
  web: { payments: typeof paymentsRouter; credits: typeof webCreditsRouter };
};

export const appRouter: AppRouterDefinition = {
  // ============ Common APIs ============
  healthCheck: healthCheckProcedure,
  getCurrentUser: currentUserProcedure,
  privateData: privateDataProcedure,
  users: usersRouter,
  storage: storageRouter,
  payments: commonPaymentsRouter,
  credits: creditsRouter,
  video: videoRouter,
  admin: {
    billing: adminBillingRouter,
    operations: adminOperationsRouter,
  },
  // ============ Web-specific APIs ============
  web: {
    payments: paymentsRouter,
    credits: webCreditsRouter,
  },
};

/** Server-side oRPC router type. */
export type AppRouter = typeof appRouter;
/** Client type generated from the oRPC router. */
export type AppRouterClient = RouterClient<typeof appRouter>;
