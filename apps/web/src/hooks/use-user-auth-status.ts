import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SocialProvider, UserAuthStatus } from "@/types/auth";
import { hasSocialProviders } from "@/utils/auth";

interface UseUserAuthStatusProps {
  passwordStatus: UseQueryResult<UserAuthStatus>;
}

interface UserAuthState {
  isLoading: boolean;
  isError: boolean;
  hasPassword: boolean;
  socialProviders: SocialProvider[];
  isSocialUser: boolean;
  isPasswordUser: boolean;
}

/**
 * Custom hook to manage user authentication status logic
 */
export function useUserAuthStatus({ passwordStatus }: UseUserAuthStatusProps): UserAuthState {
  return useMemo(() => {
    const isLoading = passwordStatus.isLoading;
    const isError = passwordStatus.isError;
    const hasPassword = passwordStatus.data?.hasPassword ?? false;
    const socialProviders = passwordStatus.data?.socialProviders ?? [];

    // User is considered social user if:
    // - Not loading and no error
    // - Has no password
    // - Has at least one social provider
    const isSocialUser =
      !isLoading && !isError && !hasPassword && hasSocialProviders(socialProviders);

    // User is considered password user if:
    // - Not loading and no error
    // - Has password set
    const isPasswordUser = !isLoading && !isError && hasPassword;

    return {
      isLoading,
      isError,
      hasPassword,
      socialProviders,
      isSocialUser,
      isPasswordUser,
    };
  }, [passwordStatus.isLoading, passwordStatus.isError, passwordStatus.data]);
}
