import type { Database } from "@/db";
import { createPaymentService } from "./application/service";

/**
 * Caches payment service instances per database handle.
 */
const paymentServiceCache = new WeakMap<Database, ReturnType<typeof createPaymentService>>();

/**
 * Returns a singleton payment service bound to the given database client.
 */
export function getPaymentService(db: Database) {
  const cached = paymentServiceCache.get(db);
  if (cached) {
    return cached;
  }

  const service = createPaymentService(db);
  paymentServiceCache.set(db, service);
  return service;
}
