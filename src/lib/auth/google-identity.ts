import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { cleanName, isEmailAllowed, normalizeEmail, tokensMatch } from "@/lib/auth/session";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;

const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
  timeoutDuration: 10_000,
  cooldownDuration: 1_000,
  cacheMaxAge: 600_000,
});

export type IdentityResult =
  | { ok: true; email: string; name: string }
  | { ok: false; reason: "unverified" | "not-allowed" | "invalid" };

export async function verifyGoogleIdToken(
  idToken: string,
  options: { audience: string; nonce: string; keys?: JWTVerifyGetKey },
): Promise<IdentityResult> {
  if (idToken.length < 20 || idToken.length > 20_000) return { ok: false, reason: "invalid" };
  try {
    const { payload } = await jwtVerify(idToken, options.keys ?? googleJwks, {
      algorithms: ["RS256"],
      issuer: [...GOOGLE_ISSUERS],
      audience: options.audience,
      clockTolerance: 60,
    });
    if (typeof payload.nonce !== "string" || !tokensMatch(payload.nonce, options.nonce)) {
      return { ok: false, reason: "invalid" };
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return { ok: false, reason: "invalid" };
    const email = normalizeEmail(payload.email);
    if (!email) return { ok: false, reason: "invalid" };
    if (payload.email_verified !== true) return { ok: false, reason: "unverified" };
    if (!isEmailAllowed(email)) return { ok: false, reason: "not-allowed" };
    return { ok: true, email, name: cleanName(payload.name) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
