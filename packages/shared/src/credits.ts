export type CreditTransactionLabelKey =
  | "signupGrant"
  | "subscriptionGrant"
  | "purchase"
  | "refund"
  | "usage"
  | "expiration"
  | "adjustment";

export type CreditTransactionSourceKey = "system" | "app" | "admin" | "web" | "native" | "provider";

export function resolveCreditTransactionLabel(sourceType: string): CreditTransactionLabelKey {
  switch (sourceType) {
    case "signup_grant":
      return "signupGrant";
    case "subscription_grant":
      return "subscriptionGrant";
    case "purchase":
      return "purchase";
    case "refund":
      return "refund";
    case "usage":
      return "usage";
    case "expiration":
      return "expiration";
    default:
      return "adjustment";
  }
}

export function resolveCreditTransactionSource(sourceProvider: string): CreditTransactionSourceKey {
  switch (sourceProvider) {
    case "system":
      return "system";
    case "app":
      return "app";
    case "admin":
      return "admin";
    case "stripe":
    case "creem":
      return "web";
    case "revenuecat":
      return "native";
    default:
      return "provider";
  }
}
