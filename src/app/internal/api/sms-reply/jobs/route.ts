import { SESSION_COOKIE, readSession } from "@/lib/auth/session";
import { isBusiness } from "@/lib/jobs-app/types";
import { publicOrigin } from "@/lib/jobs-app/origin";
import { listSmsJobs, smsJobContacts } from "@/lib/sms-reply-jobs";

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
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return json({ ok: false, message: "That request was not valid." }, 400);
    }
  }
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const jobId = typeof row.jobId === "string" ? row.jobId : "";
  if (!jobId) {
    const listed = await listSmsJobs();
    if (!listed.body.ok) return json({ ok: false, message: listed.body.message }, listed.status);
    return json({ ok: true, jobs: listed.body.jobs });
  }
  if (!isBusiness(row.business)) return json({ ok: false, message: "That job was not recognised." }, 400);
  const contacts = await smsJobContacts(row.business, jobId);
  if (!contacts.body.ok) return json({ ok: false, message: contacts.body.message }, contacts.status);
  return json({ ok: true, business: contacts.body.business, jobId: contacts.body.jobId, contacts: contacts.body.contacts });
}
