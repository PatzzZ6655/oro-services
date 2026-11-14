import { NextResponse } from "next/server";
import { verifyGoogleIdToken } from "@/lib/auth/google-identity";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  OAUTH_MAX_AGE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  bytesToBase64Url,
  cookieOptions,
  openToken,
  sealToken,
  signSession,
  tokensMatch,
} from "@/lib/auth/session";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const CALLBACK_PATH = "/internal/auth/google/callback";

const textEncoder = new TextEncoder();

function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";
  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost)) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : url.protocol.replace(":", "");
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}

export function googleRedirectUri(origin: string): string {
  return `${origin}${CALLBACK_PATH}`;
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function createOauthTransaction(nowMs = Date.now()) {
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const codeChallenge = await pkceChallenge(verifier);
  const token = await sealToken("oauth", { state, nonce, verifier }, OAUTH_MAX_AGE, nowMs);
  return { state, nonce, verifier, codeChallenge, token };
}

async function readOauthTransaction(token: string | undefined) {
  if (!token) return null;
  const body = await openToken("oauth", token);
  if (!body) return null;
  const { state, nonce, verifier } = body;
  if (typeof state !== "string" || typeof nonce !== "string" || typeof verifier !== "string") return null;
  if (state.length < 32 || nonce.length < 32 || verifier.length < 43 || verifier.length > 128) return null;
  return { state, nonce, verifier };
}

function cookieHeader(request: Request, name: string): string {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return "";
    }
  }
  return "";
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function clearOauth(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0, OAUTH_COOKIE_PATH));
  return response;
}

function loginError(origin: string, error: "state" | "signin" | "unavailable"): NextResponse {
  return clearOauth(noStore(NextResponse.redirect(new URL(`/internal/login?error=${error}`, origin), 302)));
}

export async function beginGoogleSignIn(request: Request): Promise<Response> {
  const origin = publicOrigin(request);
  if (!authConfigured()) return loginError(origin, "unavailable");

  const tx = await createOauthTransaction();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", tx.state);
  url.searchParams.set("nonce", tx.nonce);
  url.searchParams.set("code_challenge", tx.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  const response = noStore(NextResponse.redirect(url, 302));
  response.cookies.set(OAUTH_COOKIE, tx.token, cookieOptions(OAUTH_MAX_AGE, OAUTH_COOKIE_PATH));
  return response;
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
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200) {
    console.error("google token exchange failed", response.status);
    throw new Error("google token exchange failed");
  }
  const json = (await response.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string") throw new Error("google token exchange failed");
  return json.id_token;
}

export async function finishGoogleSignIn(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  if (!authConfigured()) return loginError(origin, "unavailable");
  if (url.searchParams.get("error")) return loginError(origin, "signin");

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (code.length < 8 || code.length > 2048 || /[\s\u0000-\u001f]/.test(code) || !state) {
    return loginError(origin, "state");
  }

  const tx = await readOauthTransaction(cookieHeader(request, OAUTH_COOKIE));
  if (!tx || !tokensMatch(tx.state, state)) return loginError(origin, "state");

  let idToken: string;
  try {
    idToken = await exchangeCode({
      code,
      redirectUri: googleRedirectUri(origin),
      verifier: tx.verifier,
    });
  } catch {
    return loginError(origin, "signin");
  }

  const identity = await verifyGoogleIdToken(idToken, { audience: clientId(), nonce: tx.nonce });
  if (!identity.ok) {
    if (identity.reason === "unverified" || identity.reason === "not-allowed") {
      console.error("google sign-in refused", identity.reason);
      return clearOauth(noStore(NextResponse.redirect(new URL("/internal/login?error=denied", origin), 302)));
    }
    return loginError(origin, "signin");
  }

  let session: string;
  try {
    session = await signSession(identity.email, identity.name);
  } catch {
    return clearOauth(noStore(NextResponse.redirect(new URL("/internal/login?error=denied", origin), 302)));
  }

  const response = clearOauth(noStore(NextResponse.redirect(new URL("/internal", origin), 302)));
  response.cookies.set(SESSION_COOKIE, session, cookieOptions(SESSION_MAX_AGE));
  return response;
}
