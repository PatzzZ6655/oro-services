import { connection } from "next/server";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { addPhotoIssue, parsePhotoBook } from "@/lib/jobs-app/photo-book";
import { loadPhotoBook, photoDriveConfigured, savePhotoBook } from "@/lib/jobs-app/photo-drive";
import { listAllNotionJobs } from "@/lib/sms-reply-jobs";
import { cleanJobId } from "@/lib/jobs-app/webhooks";
import { isBusiness } from "@/lib/jobs-app/types";

export const maxDuration = 30;

function jobIdOf(value: unknown): string {
  const cleaned = cleanJobId(typeof value === "string" ? value : "");
  return cleaned ? cleaned.replace(/-/g, "") : "";
}

export async function POST(request: Request) {
  await connection();
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "jobs") {
    const listed = await listAllNotionJobs();
    if (!listed.body.ok) return jobsJson({ ok: false, message: listed.body.message }, listed.status);
    const jobs = listed.body.jobs
      .map((job) => ({
        business: job.business,
        jobId: job.jobId.replace(/-/g, ""),
        title: job.title,
        address: job.address,
        status: job.status,
      }))
      .sort((left, right) => (left.address || left.title).localeCompare(right.address || right.title, "en-AU"));
    return jobsJson({ ok: true, jobs });
  }

  const business = body?.business;
  const jobId = jobIdOf(body?.jobId);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!isBusiness(business) || !jobId) return jobsJson({ ok: false, message: "Choose a job." }, 400);
  if (!photoDriveConfigured()) return jobsJson({ ok: false, message: "Google Drive isn't connected." }, 503);

  if (action === "load") {
    try {
      const book = await loadPhotoBook(business, jobId, title);
      return jobsJson({ ok: true, book });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo list could not be opened.";
      return jobsJson({ ok: false, message }, 502);
    }
  }

  if (action === "issue") {
    const level = typeof body?.level === "string" ? body.level : "";
    const area = typeof body?.area === "string" ? body.area : "";
    const note = typeof body?.note === "string" ? body.note : "";
    const id = typeof body?.id === "string" ? body.id : "";
    try {
      const current = await loadPhotoBook(business, jobId, title);
      const next = addPhotoIssue({ ...current, title: title || current.title }, level, area, note, id);
      if ("error" in next) return jobsJson({ ok: false, message: next.error }, 400);
      await savePhotoBook(next);
      return jobsJson({ ok: true, book: next });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The issue could not be saved.";
      return jobsJson({ ok: false, message }, 502);
    }
  }

  if (action === "save") {
    const book = parsePhotoBook(body?.book, { business, jobId });
    if (!book) return jobsJson({ ok: false, message: "That photo list could not be saved." }, 400);
    try {
      await savePhotoBook({ ...book, title: title || book.title });
      return jobsJson({ ok: true, book: { ...book, title: title || book.title } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo list could not be saved.";
      return jobsJson({ ok: false, message }, 502);
    }
  }

  return jobsJson({ ok: false, message: "That action is not available." }, 400);
}
