import { connection } from "next/server";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { photoFileName } from "@/lib/jobs-app/photo-book";
import { loadPhotoBook, photoDriveConfigured, storePhotoBytes } from "@/lib/jobs-app/photo-drive";
import { cleanJobId } from "@/lib/jobs-app/webhooks";
import { isBusiness } from "@/lib/jobs-app/types";

export const maxDuration = 60;

const maxBytes = 3_500_000;

function jpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function POST(request: Request) {
  await connection();
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jobsJson({ ok: false, message: "That photo could not be read." }, 400);
  }
  const business = form.get("business");
  const jobField = form.get("jobId");
  const titleField = form.get("title");
  const issueField = form.get("issueId");
  const angleField = form.get("angleId");
  const sideField = form.get("side");
  const jobId = cleanJobId(typeof jobField === "string" ? jobField : "")?.replace(/-/g, "") ?? "";
  const title = typeof titleField === "string" ? titleField.trim().slice(0, 120) : "";
  const issueId = typeof issueField === "string" ? issueField : "";
  const angleId = typeof angleField === "string" ? angleField : "";
  const side = sideField === "before" || sideField === "after" || sideField === "collage" ? sideField : "";
  const file = form.get("file");
  if (!isBusiness(business) || !jobId || !side || !(file instanceof File)) {
    return jobsJson({ ok: false, message: "That photo could not be saved." }, 400);
  }
  if (!photoDriveConfigured()) return jobsJson({ ok: false, message: "Google Drive isn't connected." }, 503);
  if (file.size > maxBytes || file.type !== "image/jpeg") return jobsJson({ ok: false, message: "Use a smaller JPEG." }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!jpeg(bytes)) return jobsJson({ ok: false, message: "Use a JPEG photo." }, 400);
  try {
    const book = await loadPhotoBook(business, jobId, title);
    const issue = book.issues.find((item) => item.id === issueId);
    if (!issue) return jobsJson({ ok: false, message: "That issue is not on this job." }, 400);
    const found = issue.angles.findIndex((angle) => angle.id === angleId);
    const takenField = form.get("taken");
    const taken = typeof takenField === "string" && /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(takenField) ? takenField : "";
    const name = photoFileName(issue.level, issue.area, side, found >= 0 ? found : issue.angles.length, taken);
    const next = await storePhotoBytes({ ...book, title: title || book.title }, { issueId, angleId, side, bytes, name });
    return jobsJson({ ok: true, book: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The photo could not be saved.";
    return jobsJson({ ok: false, message }, 502);
  }
}
