import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth-client";

export const useSignOut = () => {
  const navigate = useNavigate();

  const signOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/" });
        },
        onError: (error) => {
          console.error(error);
          toast.error(error.error.message || error.error.statusText);
        },
      },
    });
  };

  return {
    signOut,
  };
};
