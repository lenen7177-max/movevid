import { useEffect } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { trackAuthSession } from "./events";

/** Sends sign_up (new account) or login once per browser session when a user is signed in. */
export function AuthEventTracker() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    if (user) trackAuthSession({ id: user.id, createdAt: user.createdAt });
  }, [user]);

  return null;
}
