export const SESSION_COOKIE = "oro_session";
export const OAUTH_COOKIE = "oro_oauth";
export const OAUTH_COOKIE_PATH = "/internal/auth/google";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
export const OAUTH_MAX_AGE = 60 * 10;
export const MIN_SESSION_SECRET = 16;

const SESSION_PREFIX = "oro_session.v1.";
const OAUTH_PREFIX = "oro_oauth.v1.";
const CLOCK_SKEW_SECONDS = 60;
const STARTER_ALLOWLIST = "pat.z@orosvc.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type StaffSession = {
  email: string;
  name: string;
};

function trimmedEnv(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

export function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Comma-separated allowlist. A blank variable starts at pat.z@orosvc.com.
 * A non-blank variable replaces that starter list entirely.
 * There is no failure counter and no lockout.
 */
export function allowedEmails(raw: string | undefined = process.env.INTERNAL_ALLOWED_EMAILS): Set<string> | null {
  const source = typeof raw === "string" && raw.trim() ? raw : STARTER_ALLOWLIST;
  const emails = source
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter((email): email is string => Boolean(email));
  return emails.length > 0 ? new Set(emails) : null;
}

export function isEmailAllowed(email: string, raw?: string): boolean {
  const list = allowedEmails(raw);
  const normalized = normalizeEmail(email);
  if (!list || !normalized) return false;
  return list.has(normalized);
}

export function authProblems(): string[] {
  const problems: string[] = [];
  if (!trimmedEnv(process.env.GOOGLE_CLIENT_ID)) problems.push("GOOGLE_CLIENT_ID");
  if (!trimmedEnv(process.env.GOOGLE_CLIENT_SECRET)) problems.push("GOOGLE_CLIENT_SECRET");
  const secret = trimmedEnv(process.env.INTERNAL_SESSION_SECRET);
  if (!secret || secret.length < MIN_SESSION_SECRET) problems.push("INTERNAL_SESSION_SECRET");
  if (!allowedEmails()) problems.push("INTERNAL_ALLOWED_EMAILS");
  return problems;
}

export function authConfigured(): boolean {
  return authProblems().length === 0;
}

export function tokensMatch(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export function cookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge,
  };
}

function sessionSecret(): string | null {
  const secret = trimmedEnv(process.env.INTERNAL_SESSION_SECRET);
  if (!secret || secret.length < MIN_SESSION_SECRET) return null;
  return secret;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
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

async function hmac(prefix: string, payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(prefix + payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

type TokenKind = "session" | "oauth";

function prefixFor(kind: TokenKind): string {
  return kind === "session" ? SESSION_PREFIX : OAUTH_PREFIX;
}

export async function sealToken(
  kind: TokenKind,
  claims: Record<string, string>,
  ttlSeconds: number,
  nowMs = Date.now(),
): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("INTERNAL_SESSION_SECRET is not configured");
  const body = {
    ...claims,
    v: 1,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const payload = bytesToBase64Url(textEncoder.encode(JSON.stringify(body)));
  const signature = await hmac(prefixFor(kind), payload, secret);
  return `${payload}.${signature}`;
}

export async function openToken(
  kind: TokenKind,
  token: string,
  nowMs = Date.now(),
): Promise<Record<string, unknown> | null> {
  const secret = sessionSecret();
  if (!secret || token.length === 0 || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = await hmac(prefixFor(kind), payload, secret);
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

export async function signSession(email: string, name = "", nowMs = Date.now()): Promise<string> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isEmailAllowed(normalized)) throw new Error("email is not allowed");
  return sealToken("session", { email: normalized, name: cleanName(name) }, SESSION_MAX_AGE, nowMs);
}

export async function readSession(token: string | undefined | null, nowMs = Date.now()): Promise<StaffSession | null> {
  if (!token || !authConfigured()) return null;
  const body = await openToken("session", token, nowMs);
  if (!body) return null;
  const email = normalizeEmail(body.email);
  if (!email || !isEmailAllowed(email)) return null;
  return { email, name: cleanName(body.name) };
}
