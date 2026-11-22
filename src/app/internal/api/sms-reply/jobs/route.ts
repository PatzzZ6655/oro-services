import { SESSION_COOKIE, readSession } from "@/lib/auth/session";
import { isBusiness } from "@/lib/jobs-app/types";
import { publicOrigin } from "@/lib/jobs-app/origin";
import { allowSmsReply, extractSmsAddress, parseSmsImage } from "@/lib/sms-reply";
import { normalizePhone } from "@/lib/jobs-app/phones";
import { findSmsPhones, listSmsJobs, matchActiveSmsJobs, matchJobsByPhone, saveTenantPhone, smsJobContacts } from "@/lib/sms-reply-jobs";

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
  if (row.save === true) {
    if (!isBusiness(row.business)) return json({ ok: false, message: "That job was not recognised." }, 400);
    const phone = normalizePhone(typeof row.phone === "string" ? row.phone : "");
    if (!phone) return json({ ok: false, message: "That number could not be saved." }, 400);
    const name = typeof row.name === "string" ? row.name : "";
    const saved = await saveTenantPhone(row.business, jobId, phone, name);
    if (!saved.body.ok) return json({ ok: false, message: saved.body.message }, saved.status);
    return json({ ok: true, action: saved.body.action, phone: saved.body.phone });
  }
  if (!jobId && row.image) {
    const image = parseSmsImage(row.image);
    if (image === "bad" || !image) return json({ ok: false, message: "That screenshot could not be read. Try another photo." }, 400);
    if (!allowSmsReply(session.email)) {
      return json({ ok: false, message: "Too many replies just now. Wait a few minutes and try again." }, 429);
    }
    const listed = await listSmsJobs();
    if (!listed.body.ok) return json({ ok: false, message: listed.body.message }, listed.status);
    const found = await extractSmsAddress(image);
    if (!found.ok) return json({ ok: false, message: found.message }, found.status);
    const facts = found.facts;
    let matches = facts.address ? matchActiveSmsJobs(facts.address, listed.body.jobs) : [];
    let matchedBy: "address" | "phone" | "" = matches.length > 0 ? "address" : "";
    if (!facts.address && facts.phone && !facts.name) {
      const links = await findSmsPhones(facts.phone);
      matches = matchJobsByPhone(facts.phone, listed.body.jobs, links);
      matchedBy = matches.length > 0 ? "phone" : "";
    }
    return json({ ok: true, address: facts.address, phone: facts.phone, name: facts.name, matchedBy, matches, jobs: listed.body.jobs });
  }
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
