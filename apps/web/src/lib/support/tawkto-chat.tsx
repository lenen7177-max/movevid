import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth/auth-client";
import {
  hideTawkTo,
  identifyTawkVisitor,
  isAuthPath,
  isTawkToConfigured,
  loadTawkTo,
  resetTawkTo,
  showTawkTo,
} from "./tawkto";

/**
 * Loads the Tawk.to widget on public and authed pages when configured.
 * Auth routes keep the bubble hidden. Session changes re-identify or reset the visitor.
 */
export function TawkToChat() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: session } = authClient.useSession();
  const previousUserIdRef = useRef<string | null>(null);
  const userId = session?.user.id ?? null;
  const name = session?.user.name?.trim() || undefined;
  const email = session?.user.email?.trim() || undefined;
  const onAuthPage = isAuthPath(pathname);

  useEffect(() => {
    if (!isTawkToConfigured()) {
      return;
    }

    const visitor = name || email ? { name, email } : undefined;
    let cancelled = false;

    const syncWidget = async () => {
      const previousUserId = previousUserIdRef.current;
      if (previousUserId && previousUserId !== userId) {
        resetTawkTo();
      }
      previousUserIdRef.current = userId;

      if (cancelled) {
        return;
      }

      if (onAuthPage) {
        hideTawkTo();
        return;
      }

      await loadTawkTo(visitor);
      if (cancelled) {
        return;
      }

      if (visitor) {
        identifyTawkVisitor(visitor);
      }
      showTawkTo();
    };

    syncWidget();

    return () => {
      cancelled = true;
    };
  }, [email, name, onAuthPage, userId]);

  return null;
}
