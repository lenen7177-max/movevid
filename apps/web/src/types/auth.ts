/**
 * Supported social login providers
 */
export const SOCIAL_PROVIDERS = ["github", "google"] as const;

/**
 * Social provider type
 */
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * User authentication status
 */
export interface UserAuthStatus {
  hasPassword: boolean;
  socialProviders?: SocialProvider[];
}
