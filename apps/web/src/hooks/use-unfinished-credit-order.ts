import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { orpc } from "@/utils/orpc";

type CreditOrder = Awaited<ReturnType<typeof orpc.credits.listOrders.call>>["data"][number];

const SHOWN_KEY_PREFIX = "credits.unfinishedShown:";
// Leave buyers alone right after they back out of a checkout.
const MIN_AGE_MS = 30 * 60 * 1000;
// Older carts are stale; the buyer has moved on.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** True only the first time this order is offered in this browser. */
function claimOrder(orderId: string): boolean {
  try {
    const key = `${SHOWN_KEY_PREFIX}${orderId}`;
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, "1");
    return true;
  } catch {
    // Storage blocked: skip rather than nag on every page load.
    return false;
  }
}

/**
 * Once per visit, looks at the signed-in user's latest credit order and calls onFound when it
 * was left unpaid (pending or expired) between 30 minutes and 3 days ago. Each order is offered
 * once per browser; a newer completed order means nothing is unfinished.
 */
export function useUnfinishedCreditOrder(enabled: boolean, onFound: (order: CreditOrder) => void) {
  const onFoundRef = useRef(onFound);

  useEffect(() => {
    onFoundRef.current = onFound;
  });

  const latestOrderQuery = useQuery({
    queryKey: ["credits", "orders", "latest"],
    queryFn: () => orpc.credits.listOrders.call({ page: 1, perPage: 1 }),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const order = latestOrderQuery.data?.data[0];
    if (!order || (order.status !== "pending" && order.status !== "expired")) return;
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    if (ageMs < MIN_AGE_MS || ageMs > MAX_AGE_MS) return;
    if (!claimOrder(order.id)) return;
    onFoundRef.current(order);
  }, [latestOrderQuery.data]);
}
