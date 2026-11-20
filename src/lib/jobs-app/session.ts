import { jobsEmailAllowed } from "@/lib/jobs-app/allowlist";
import { normalizeEmail } from "@/lib/auth/session";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const JOBS_COOKIE = "oro_jobs";
export const JOBS_OAUTH_COOKIE = "oro_jobs_oauth";
export const JOBS_MAX_AGE = 60 * 60 * 24 * 180;
export const JOBS_OAUTH_MAX_AGE = 60 * 10;
const PREFIX = { session: "oro_jobs.v1.", oauth: "oro_jobs_oauth.v1." } as const;
const MIN_SECRET = 16;
const CLOCK_SKEW_SECONDS = 60;

type TokenKind = keyof typeof PREFIX;

function trimmed(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next.length > 0 ? next : null;
}

export function jobsSessionSecret(raw = process.env.JOBS_SESSION_SECRET): string | null {
  const secret = trimmed(raw);
  if (!secret || secret.length < MIN_SECRET) return null;
  return secret;
}

export function jobsCookieOptions(maxAge = JOBS_MAX_AGE, secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/jobs",
    maxAge,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

async function hmac(kind: TokenKind, payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(PREFIX[kind] + payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

async function seal(kind: TokenKind, claims: Record<string, string>, ttlSeconds: number, nowMs: number): Promise<string> {
  const secret = jobsSessionSecret();
  if (!secret) throw new Error("JOBS_SESSION_SECRET is not configured");
  const body = { ...claims, v: 1, iat: Math.floor(nowMs / 1000), exp: Math.floor(nowMs / 1000) + ttlSeconds };
  const payload = bytesToBase64Url(textEncoder.encode(JSON.stringify(body)));
  const signature = await hmac(kind, payload, secret);
  return `${payload}.${signature}`;
}

async function open(kind: TokenKind, token: string, nowMs: number): Promise<Record<string, unknown> | null> {
  const secret = jobsSessionSecret();
  if (!secret || token.length === 0 || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = await hmac(kind, payload, secret);
  if (!tokensMatch(signature, expected)) return null;
  const bytes = base64UrlToBytes(payload);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as { v?: unknown; iat?: unknown; exp?: unknown };
  if (body.v !== 1 || typeof body.iat !== "number" || typeof body.exp !== "number") return null;
  if (!Number.isInteger(body.iat) || !Number.isInteger(body.exp)) return null;
  const now = Math.floor(nowMs / 1000);
  if (body.exp <= now || body.iat > now + CLOCK_SKEW_SECONDS) return null;
  return parsed as Record<string, unknown>;
}

export async function signJobsSession(email: string, nowMs = Date.now()): Promise<string> {
  const normalized = normalizeEmail(email);
  if (!normalized || !jobsEmailAllowed(normalized)) throw new Error("email is not allowed");
  return seal("session", { email: normalized }, JOBS_MAX_AGE, nowMs);
}

export async function readJobsSession(token: string | undefined | null, nowMs = Date.now()): Promise<{ ok: true; email: string } | null> {
  if (!token) return null;
  const body = await open("session", token, nowMs);
  if (!body) return null;
  const email = normalizeEmail(body.email);
  if (!email || !jobsEmailAllowed(email)) return null;
  return { ok: true, email };
}

export async function sealJobsOauth(claims: { state: string; nonce: string; verifier: string }, nowMs = Date.now()): Promise<string> {
  return seal("oauth", claims, JOBS_OAUTH_MAX_AGE, nowMs);
}

export async function openJobsOauth(token: string | undefined | null, nowMs = Date.now()): Promise<{ state: string; nonce: string; verifier: string } | null> {
  if (!token) return null;
  const body = await open("oauth", token, nowMs);
  if (!body) return null;
  const { state, nonce, verifier } = body;
  if (typeof state !== "string" || typeof nonce !== "string" || typeof verifier !== "string") return null;
  if (state.length < 32 || nonce.length < 32 || verifier.length < 43 || verifier.length > 128) return null;
  return { state, nonce, verifier };
}

export function serializeJobsCookie(name: string, value: string, options = jobsCookieOptions()): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function jobsCookieValue(request: Request, name = JOBS_COOKIE): string {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const trimmedPart = part.trim();
    const eq = trimmedPart.indexOf("=");
    if (eq === -1 || trimmedPart.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmedPart.slice(eq + 1));
    } catch {
      return "";
    }
  }
  return "";
}
