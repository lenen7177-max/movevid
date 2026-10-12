import { useEffect } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/utils/orpc";
import { captureFirstTouch, markAcquisitionReported, pendingAcquisition } from "./acquisition";

/**
 * Records where each visitor first came from, and sends it to the server once after sign-up so
 * orders can be traced to ChatGPT, Google, X and other channels.
 */
export function AcquisitionReporter() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    captureFirstTouch();
  }, []);

  useEffect(() => {
    if (!user) return;
    const touch = pendingAcquisition({ id: user.id, createdAt: user.createdAt });
    if (!touch) return;
    // Best effort: a failed report is retried on a later page load while the account is new.
    orpc.users.recordAcquisition
      .call(touch)
      .then(() => markAcquisitionReported(user.id))
      .catch(() => undefined);
  }, [user]);

  return null;
}
