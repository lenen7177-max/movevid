import { env } from "cloudflare:workers";
import { createRemoteJWKSet, decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

type AppleIdTokenPayload = {
  email?: string;
  email_verified?: boolean | "true" | "false";
  name?: string;
  nonce?: string;
  picture?: string;
  sub: string;
};

type AppleIdentityTokenUser = {
  email?: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

const APPLE_IDENTITY_TOKEN_JWKS = [
  {
    alg: "RS256",
    e: "AQAB",
    kid: "5iq33lJBYj",
    kty: "RSA",
    n: "vcDUGnc9ITh348cRCn6CENlcFzOm4X_sxDyPumPZrM3YhH_zXfjNhBCQnvTGNFqGzsqok87ufbWSEqYiYQDsh8DMTT_tx5bcuRJI-LmuX3CkLOKq0KXVUzijpj45mTvdGoC_dL2ei_nGs9yz0EJwilNpwPZxkGxNhWi7MWobOd4BjzBIkqDw_HqKZ_486EKHhyV0qgXfwQYgnKT9blBYc6ZNej9MPHyve5lZs084uEiY_UYjV0rlxfZdYa0g3scG7wc2dWMlqZ4QvbPMj0KTzMNtO-9cr3aruTTPQ2qDqFAThZDNrPaScJIXAcgrARvqy1CAMT_8gSYFbb4Ld0tRbQ",
    use: "sig",
  },
  {
    alg: "RS256",
    e: "AQAB",
    kid: "5RFOSiNIUm",
    kty: "RSA",
    n: "qaLbQzOrRmIXwJkuWpRu7T6ApMcoBA_QxFUO4foV5A1JhEE_Gg4uOCQ8kDSPJHGhPl8RBZ0o4niyUWYkS3IIgjUq3pMAwSDxczqKq00Z82gCN6nYAwlI-_iMsepM5kk86XjB_MJMVdU3NGCHReITotsyXnZ0A7v0RU_LYLzdgoobsK1jh5y4XsgiDf25ZGILiYjxVzYNcaJ5G01Rg9j0ydEJYMOC_dT9xcfQzy2LiOlhGn3rDpQIyhVuqprvUeLAJPEFQoH486VjcnDxKMLCs2L5aSlTj78BxgYNV24FRRTl8QAyhIMi4e0Ja_4i59OCOVZMbR4p1_o_cszhOGIlmw",
    use: "sig",
  },
  {
    alg: "RS256",
    e: "AQAB",
    kid: "1E6VioIaNI",
    kty: "RSA",
    n: "ttL4HNkWLS_Oh0GADZqA4lTM8Y8UyaCR2NfIcvxby6quhwIISI9o9iCw3ggMYnqEG-dfRHcpsWLp2MZH_CNC-2pB0l_tDKeLi1eytR0_3YUHQBBQlkDjDP-hlyS0xJD1ds0un4mOIhc-oPHK2xiYbSVbJcBTKYA6FPoAa7u_YbsKN1YnUqzoRf2iOpARBurhCkvmJKjXwcH6RNGM9iScOO-U9orB5-EQivCKdDnMiwsPaA6_Jx1DzKyaZI6UCV_CZV3k59XvbeYGV3JXJMtKjlwaIumX3i5ecT4lz_XUr7ZYf1tA1v4ewGnrb5TFr86U-NE6uhvEtpA-_uVWPMmy_Q",
    use: "sig",
  },
] as const;

const appleRemoteJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

async function getLocalAppleSigningKey(kid: string, alg: string) {
  const jwk = APPLE_IDENTITY_TOKEN_JWKS.find((key) => key.kid === kid);

  if (!jwk) {
    throw new Error(`Apple JWK not found for kid: ${kid}. Update APPLE_IDENTITY_TOKEN_JWKS.`);
  }

  return importJWK(jwk, alg);
}

function buildAppleUserName(
  user: AppleIdentityTokenUser | undefined,
  profile: AppleIdTokenPayload,
) {
  const firstName = user?.name?.firstName?.trim();
  const lastName = user?.name?.lastName?.trim();

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return profile.name || "";
}

function getAppleEmailVerified(emailVerified: AppleIdTokenPayload["email_verified"]) {
  return typeof emailVerified === "boolean" ? emailVerified : emailVerified === "true";
}

export async function verifyAppleIdentityToken(token: string, nonce?: string) {
  const { alg, kid } = decodeProtectedHeader(token);

  if (!alg) {
    return false;
  }

  try {
    const verificationOptions = {
      algorithms: [alg],
      audience: env.APPLE_APP_BUNDLE_IDENTIFIER,
      issuer: "https://appleid.apple.com",
      maxTokenAge: "1h",
    };

    const verificationResult =
      env.NODE_ENV === "development"
        ? await jwtVerify(token, await getLocalAppleSigningKey(kid ?? "", alg), verificationOptions)
        : await jwtVerify(token, appleRemoteJwks, verificationOptions);

    if (nonce && verificationResult.payload.nonce !== nonce) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("[apple idToken] verify failed", error);
    return false;
  }
}

export async function getAppleUserInfoFromIdentityToken(token: {
  idToken?: string;
  user?: AppleIdentityTokenUser;
}) {
  if (!token.idToken) {
    return null;
  }

  const profile = decodeJwt<AppleIdTokenPayload>(token.idToken);
  if (!profile?.sub) {
    return null;
  }

  const email = token.user?.email || profile.email;
  if (!email) {
    return null;
  }

  return {
    data: profile,
    user: {
      email,
      emailVerified: getAppleEmailVerified(profile.email_verified),
      id: profile.sub,
      image: profile.picture,
      name: buildAppleUserName(token.user, profile),
    },
  };
}

export function getAppleProviderConfig() {
  return {
    appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER || "",
    clientId: env.APPLE_APP_BUNDLE_IDENTIFIER || "",
    enabled: true,
    getUserInfo: getAppleUserInfoFromIdentityToken,
    verifyIdToken: verifyAppleIdentityToken,
  };
}
