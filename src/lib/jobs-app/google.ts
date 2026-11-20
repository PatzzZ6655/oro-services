import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { jobsAllowlist, jobsEmailAllowed } from "@/lib/jobs-app/allowlist";
import { publicOrigin } from "@/lib/jobs-app/origin";
import { GOOGLE_ISSUERS, GOOGLE_JWKS_URL } from "@/lib/auth/google-identity";
import { cleanName, normalizeEmail, tokensMatch } from "@/lib/auth/session";
import {
  JOBS_COOKIE,
  JOBS_MAX_AGE,
  JOBS_OAUTH_COOKIE,
  JOBS_OAUTH_MAX_AGE,
  jobsCookieOptions,
  jobsCookieValue,
  jobsSessionSecret,
  openJobsOauth,
  sealJobsOauth,
  serializeJobsCookie,
  signJobsSession,
} from "@/lib/jobs-app/session";

export const JOBS_GOOGLE_START_PATH = "/jobs/auth/google";
export const JOBS_GOOGLE_CALLBACK_PATH = "/jobs/auth/google/callback";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const textEncoder = new TextEncoder();
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
  timeoutDuration: 10_000,
  cooldownDuration: 1_000,
  cacheMaxAge: 600_000,
});

export type JobsIdentity =
  | { ok: true; email: string; name: string }
  | { ok: false; reason: "unverified" | "not-allowed" | "invalid" };

export function jobsGoogleRedirectUri(origin: string): string {
  return `${origin}${JOBS_GOOGLE_CALLBACK_PATH}`;
}

export function jobsGoogleConfigured(): boolean {
  return Boolean(clientId() && clientSecret() && jobsSessionSecret() && jobsAllowlist());
}

function clientId(): string {
  return process.env.JOBS_GOOGLE_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.JOBS_GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

function redirect(url: string, cookies: string[] = []): Response {
  const headers = new Headers({
    location: url,
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function oauthCookie(value: string, maxAge = JOBS_OAUTH_MAX_AGE): string {
  return serializeJobsCookie(JOBS_OAUTH_COOKIE, value, jobsCookieOptions(maxAge));
}

function loginError(origin: string, error: "state" | "signin" | "unavailable" | "denied"): Response {
  return redirect(new URL(`/jobs/login?error=${error}`, origin).toString(), [oauthCookie("", 0)]);
}

export async function verifyJobsIdToken(
  idToken: string,
  options: { audience: string; nonce: string; keys?: JWTVerifyGetKey },
): Promise<JobsIdentity> {
  if (idToken.length < 20 || idToken.length > 20_000) return { ok: false, reason: "invalid" };
  try {
    const { payload } = await jwtVerify(idToken, options.keys ?? googleJwks, {
      algorithms: ["RS256"],
      issuer: [...GOOGLE_ISSUERS],
      audience: options.audience,
      clockTolerance: 60,
    });
    if (typeof payload.nonce !== "string" || !tokensMatch(payload.nonce, options.nonce)) return { ok: false, reason: "invalid" };
    const email = normalizeEmail(payload.email);
    if (!email) return { ok: false, reason: "invalid" };
    if (payload.email_verified !== true) return { ok: false, reason: "unverified" };
    if (!jobsEmailAllowed(email)) return { ok: false, reason: "not-allowed" };
    return { ok: true, email, name: cleanName(payload.name) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

async function exchangeCode(options: { code: string; redirectUri: string; verifier: string }): Promise<string> {
  const body = new URLSearchParams({
    code: options.code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
    code_verifier: options.verifier,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200) throw new Error("google token exchange failed");
  const json = (await response.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string") throw new Error("google token exchange failed");
  return json.id_token;
}

export type JobsGoogleDeps = {
  exchangeCode?: (options: { code: string; redirectUri: string; verifier: string }) => Promise<string>;
  verify?: (idToken: string, options: { audience: string; nonce: string }) => Promise<JobsIdentity>;
};

export async function beginJobsGoogleSignIn(request: Request): Promise<Response> {
  const origin = publicOrigin(request);
  if (!jobsGoogleConfigured()) return loginError(origin, "unavailable");
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", jobsGoogleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", await pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  const token = await sealJobsOauth({ state, nonce, verifier });
  return redirect(url.toString(), [oauthCookie(token)]);
}

export async function finishJobsGoogleSignIn(request: Request, deps: JobsGoogleDeps = {}): Promise<Response> {
  const origin = publicOrigin(request);
  if (!jobsGoogleConfigured()) return loginError(origin, "unavailable");
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return loginError(origin, "signin");
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (code.length < 8 || code.length > 2048 || /[\s\u0000-\u001f]/.test(code) || !state) return loginError(origin, "state");

  const tx = await openJobsOauth(jobsCookieValue(request, JOBS_OAUTH_COOKIE));
  if (!tx || !tokensMatch(tx.state, state)) return loginError(origin, "state");

  let idToken: string;
  try {
    idToken = await (deps.exchangeCode ?? exchangeCode)({
      code,
      redirectUri: jobsGoogleRedirectUri(origin),
      verifier: tx.verifier,
    });
  } catch {
    return loginError(origin, "signin");
  }

  const identity = await (deps.verify ?? verifyJobsIdToken)(idToken, { audience: clientId(), nonce: tx.nonce });
  if (!identity.ok) {
    if (identity.reason === "not-allowed" || identity.reason === "unverified") return loginError(origin, "denied");
    return loginError(origin, "signin");
  }

  let session: string;
  try {
    session = await signJobsSession(identity.email);
  } catch {
    return loginError(origin, "denied");
  }
  return redirect(new URL("/jobs", origin).toString(), [
    oauthCookie("", 0),
    serializeJobsCookie(JOBS_COOKIE, session, jobsCookieOptions(JOBS_MAX_AGE)),
  ]);
}
