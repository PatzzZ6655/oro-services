const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const JOBS_COOKIE = "oro_jobs";
export const JOBS_MAX_AGE = 60 * 60 * 24 * 180;
const PREFIX = "oro_jobs.v1.";
const MIN_SECRET = 16;
const CLOCK_SKEW_SECONDS = 60;

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

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(PREFIX + payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export async function signJobsSession(nowMs = Date.now()): Promise<string> {
  const secret = jobsSessionSecret();
  if (!secret) throw new Error("JOBS_SESSION_SECRET is not configured");
  const body = { v: 1, p: "jobs", iat: Math.floor(nowMs / 1000), exp: Math.floor(nowMs / 1000) + JOBS_MAX_AGE };
  const payload = bytesToBase64Url(textEncoder.encode(JSON.stringify(body)));
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
}

export async function readJobsSession(token: string | undefined | null, nowMs = Date.now()): Promise<{ ok: true } | null> {
  const secret = jobsSessionSecret();
  if (!secret || !token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = await hmac(payload, secret);
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
  const body = parsed as { v?: unknown; p?: unknown; iat?: unknown; exp?: unknown };
  if (body.v !== 1 || body.p !== "jobs" || typeof body.iat !== "number" || typeof body.exp !== "number") return null;
  if (!Number.isInteger(body.iat) || !Number.isInteger(body.exp)) return null;
  const now = Math.floor(nowMs / 1000);
  if (body.exp <= now || body.iat > now + CLOCK_SKEW_SECONDS) return null;
  return { ok: true };
}

export function serializeJobsCookie(value: string, options = jobsCookieOptions()): string {
  const parts = [`${JOBS_COOKIE}=${encodeURIComponent(value)}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function jobsCookieValue(request: Request): string {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const trimmedPart = part.trim();
    const eq = trimmedPart.indexOf("=");
    if (eq === -1 || trimmedPart.slice(0, eq) !== JOBS_COOKIE) continue;
    try {
      return decodeURIComponent(trimmedPart.slice(eq + 1));
    } catch {
      return "";
    }
  }
  return "";
}
