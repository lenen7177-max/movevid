import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useCreditOrdersQuery } from "@/hooks/use-credits";
import { trackPurchase } from "@/lib/analytics/events";
import type { orpc } from "@/utils/orpc";

type CreditOrder = Awaited<ReturnType<typeof orpc.credits.listOrders.call>>["data"][number];

const PENDING_CREDIT_ORDER_STORAGE_KEY = "credits.pendingOrderId";
const PENDING_CREDIT_ORDER_EVENT = "credits:pending-order-change";
const POLL_INTERVAL_MS = 5000;
// A cancelled checkout leaves its order pending; stop watching it after this long.
const PENDING_ORDER_MAX_AGE_MS = 30 * 60 * 1000;

function subscribeToPendingCreditOrder(listener: () => void) {
  window.addEventListener(PENDING_CREDIT_ORDER_EVENT, listener);
  return () => window.removeEventListener(PENDING_CREDIT_ORDER_EVENT, listener);
}

function getPendingCreditOrderId() {
  return window.sessionStorage.getItem(PENDING_CREDIT_ORDER_STORAGE_KEY);
}

/** Remembers the order a checkout was started for, so the return page can confirm it. */
export function setPendingCreditOrderId(orderId: string | null) {
  if (orderId) {
    window.sessionStorage.setItem(PENDING_CREDIT_ORDER_STORAGE_KEY, orderId);
  } else {
    window.sessionStorage.removeItem(PENDING_CREDIT_ORDER_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(PENDING_CREDIT_ORDER_EVENT));
}

/**
 * Polls the order started before the provider checkout until the webhook settles it,
 * then refreshes credit queries and calls onCredited once when the credits landed.
 */
export function usePendingCreditOrder(onCredited: (order: CreditOrder) => void) {
  const queryClient = useQueryClient();
  const pendingOrderId = useSyncExternalStore(
    subscribeToPendingCreditOrder,
    getPendingCreditOrderId,
    () => null,
  );
  const creditOrdersQuery = useCreditOrdersQuery(Boolean(pendingOrderId));
  const onCreditedRef = useRef(onCredited);

  useEffect(() => {
    onCreditedRef.current = onCredited;
  });

  useEffect(() => {
    if (!pendingOrderId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      creditOrdersQuery.refetch();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [creditOrdersQuery.refetch, pendingOrderId]);

  useEffect(() => {
    if (!pendingOrderId || !creditOrdersQuery.data) {
      return;
    }

    const order = creditOrdersQuery.data.data.find((item) => item.id === pendingOrderId);
    if (!order) {
      return;
    }
    if (order.status === "pending") {
      if (Date.now() - new Date(order.createdAt).getTime() > PENDING_ORDER_MAX_AGE_MS) {
        setPendingCreditOrderId(null);
      }
      return;
    }

    setPendingCreditOrderId(null);
    if (order.credited) {
      trackPurchase(order.id, {
        id: order.packageId,
        name: `${order.creditAmount} credits`,
        cents: order.amountCents,
        currency: order.currency,
        kind: "credits",
      });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      onCreditedRef.current(order);
    }
  }, [creditOrdersQuery.data, pendingOrderId, queryClient]);

  return { pendingOrderId };
}
