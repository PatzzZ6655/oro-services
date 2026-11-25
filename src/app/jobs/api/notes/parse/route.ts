import { connection } from "next/server";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { parseSpokenNote } from "@/lib/jobs-app/job-notes-store";
import { guessFromSpeech } from "@/lib/jobs-app/job-notes";
import { isNoteGroup, type NoteJob } from "@/lib/jobs-app/note-groups";

export const maxDuration = 30;

export async function POST(request: Request) {
  await connection();
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text || text.length > 2000) return jobsJson({ ok: false, error: "bad_request", message: "Say a short note first." }, 400);
  const jobs = Array.isArray(input.jobs) ? (input.jobs as NoteJob[]) : [];
  const chosen = typeof input.jobId === "string" ? input.jobId : "";
  const group = isNoteGroup(input.group) ? input.group : "chore";
  const parsed = await parseSpokenNote(text);
  const suggestion = chosen || group === "chore" ? null : guessFromSpeech(text, jobs);
  return jobsJson({ ok: true, parsed, suggestion });
}
