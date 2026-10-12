import type { SocialProvider } from "@/types/auth";

/**
 * Format social login provider name for display
 * @param provider - The provider identifier (e.g., 'github', 'google')
 * @returns Formatted provider name (e.g., 'GitHub', 'Google')
 */
export function formatProviderName(provider: string): string {
  switch (provider.toLowerCase()) {
    case "github":
      return "GitHub";
    case "google":
      return "Google";
    default:
      // Fallback for unknown providers - capitalize first letter
      return provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
  }
}

/**
 * Format multiple provider names for display
 * @param providers - Array of provider identifiers
 * @returns Formatted provider names joined with ' / '
 */
export function formatProviderNames(providers: SocialProvider[]): string {
  try {
    if (!Array.isArray(providers) || providers.length === 0) {
      return "";
    }

    return providers
      .filter((provider) => provider && typeof provider === "string")
      .map(formatProviderName)
      .join(" / ");
  } catch (error) {
    console.warn("Error formatting provider names:", providers, error);
    return "Social Login";
  }
}

/**
 * Check if user has social login providers
 * @param providers - Array of provider identifiers
 * @returns Boolean indicating if user has social providers
 */
export function hasSocialProviders(providers?: SocialProvider[]): boolean {
  return Array.isArray(providers) && providers.length > 0;
}
