import { connection } from "next/server";
import { contactRole, nextNeighbourProgress, type ContactRole, type NeighbourProgress } from "@/lib/jobs-app/contact-groups";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { createJobContact, loadJob, patchJob, sendKeyPickup, sendNeighbourEmail } from "@/lib/jobs-app/job-record";
import { isBusiness } from "@/lib/jobs-app/types";

export const maxDuration = 30;

function roleOf(value: unknown): ContactRole {
  return contactRole(typeof value === "string" ? value : "");
}

export async function POST(request: Request) {
  await connection();
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const business = body?.business;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!isBusiness(business) || !jobId) return jobsJson({ ok: false, message: "Choose a job." }, 400);
  const action = typeof body?.action === "string" ? body.action : "load";

  if (action === "load") {
    const job = await loadJob(business, jobId);
    if (!job) return jobsJson({ ok: false, message: "That job could not be read." }, 404);
    return jobsJson({ ok: true, job });
  }

  if (action === "add") {
    const created = await createJobContact(business, jobId, {
      name: typeof body?.name === "string" ? body.name : "",
      phone: typeof body?.phone === "string" ? body.phone : "",
      email: typeof body?.email === "string" ? body.email : "",
      role: roleOf(body?.role),
    }, typeof body?.address === "string" ? body.address : "");
    if (!created.ok) return jobsJson({ ok: false, message: created.message }, 400);
    return jobsJson({ ok: true, pageId: created.pageId, sync: created.sync });
  }

  if (action === "remove") {
    const pageId = typeof body?.pageId === "string" ? body.pageId : "";
    if (!(await archiveContact(pageId))) return jobsJson({ ok: false, message: "That contact could not be removed." }, 502);
    return jobsJson({ ok: true });
  }

  if (action === "neighbour") {
    const current = typeof body?.current === "string" ? body.current : "none";
    const next = nextNeighbourProgress(current === "N1 sent" || current === "Followed up" || current === "Booked" || current === "none" ? current : "none");
    if (!next) return jobsJson({ ok: false, message: "The neighbour is already booked." }, 400);
    const ok = await patchJob(jobId, {
      "Neighbour Contacted": { select: { name: next } },
      "Neighbour Contacted At": { date: { start: new Date().toISOString() } },
    });
    if (!ok) return jobsJson({ ok: false, message: "The neighbour step could not be saved." }, 502);
    return jobsJson({ ok: true, neighbour: next satisfies NeighbourProgress });
  }

  if (action === "status") {
    const next = typeof body?.status === "string" ? body.status.trim() : "";
    if (!next) return jobsJson({ ok: false, message: "There is no next status." }, 400);
    const ok = await patchJob(jobId, { Status: { select: { name: next } } });
    if (!ok) return jobsJson({ ok: false, message: "The status could not be saved." }, 502);
    return jobsJson({ ok: true });
  }

  if (action === "vacant") {
    const vacant = body?.vacant === true;
    const date = typeof body?.date === "string" ? body.date : "";
    const properties: Record<string, unknown> = { "Vacant Collect Keys": { checkbox: vacant } };
    if (date) properties["Key Pickup Date"] = { date: { start: date } };
    const ok = await patchJob(jobId, properties);
    if (!ok) return jobsJson({ ok: false, message: "The vacant flag could not be saved." }, 502);
    return jobsJson({ ok: true });
  }

  if (action === "keys") {
    const returned = body?.returned === true;
    const ok = await patchJob(jobId, {
      "Keys Returned": { checkbox: returned },
      "Keys Returned At": returned ? { date: { start: new Date().toISOString() } } : { date: null },
    });
    if (!ok) return jobsJson({ ok: false, message: "The keys could not be updated." }, 502);
    return jobsJson({ ok: true });
  }

  if (action === "keyEmail") {
    const sent = await sendKeyPickup({
      business,
      jobId,
      address: typeof body?.address === "string" ? body.address : "",
      brand: typeof body?.brand === "string" ? body.brand : "",
      pmFirstName: typeof body?.pmFirstName === "string" ? body.pmFirstName : "",
      pickupDate: typeof body?.pickupDate === "string" ? body.pickupDate : "",
    });
    if (!sent.ok) return jobsJson({ ok: false, message: sent.message }, 502);
    return jobsJson({ ok: true, skipped: Boolean(sent.skipped) });
  }

  if (action === "groupEmail") {
    const contacts = Array.isArray(body?.contacts) ? body.contacts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { name?: unknown; email?: unknown; first?: unknown };
      return [{ name: typeof row.name === "string" ? row.name : "", email: typeof row.email === "string" ? row.email : "", first: typeof row.first === "string" ? row.first : "" }];
    }) : [];
    const sent = await sendNeighbourEmail({
      business,
      jobId,
      template: typeof body?.template === "string" ? body.template : "n1",
      impactLine: typeof body?.impactLine === "string" ? body.impactLine : "",
      address: typeof body?.address === "string" ? body.address : "",
      brand: typeof body?.brand === "string" ? body.brand : "",
      summary: typeof body?.summary === "string" ? body.summary : "",
      date: typeof body?.date === "string" ? body.date : "",
      contacts,
    });
    if (!sent.ok) return jobsJson({ ok: false, message: sent.message }, 502);
    return jobsJson({ ok: true, skipped: Boolean(sent.skipped) });
  }

  return jobsJson({ ok: false, message: "That action is not available." }, 400);
}

async function archiveContact(pageId: string): Promise<boolean> {
  if (!pageId) return false;
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!token) return false;
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "notion-version": "2025-09-03" },
    body: JSON.stringify({ archived: true }),
  });
  return response.ok;
}
