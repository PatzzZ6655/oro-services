import { SESSION_COOKIE, readSession } from "@/lib/auth/session";
import { publicOrigin } from "@/lib/jobs-app/origin";
import { allowSmsReply, parseSmsReply, writeEnglishSms } from "@/lib/sms-reply";

export const maxDuration = 30;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function sessionCookie(request: Request): string {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1 || trimmed.slice(0, eq) !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return "";
    }
  }
  return "";
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== publicOrigin(request)) {
    return json({ ok: false, message: "That request came from the wrong site." }, 403);
  }
  const session = await readSession(sessionCookie(request));
  if (!session) return json({ ok: false, message: "Sign in again." }, 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: "That request was not valid." }, 400);
  }
  const parsed = parseSmsReply(body);
  if (!parsed.ok) return json({ ok: false, message: parsed.message }, 400);
  if (!allowSmsReply(session.email)) {
    return json({ ok: false, message: "Too many replies just now. Wait a few minutes and try again." }, 429);
  }
  const result = await writeEnglishSms(parsed.value);
  if (!result.ok) return json({ ok: false, message: result.message }, result.status);
  return json({ ok: true, sms: result.sms });
}
