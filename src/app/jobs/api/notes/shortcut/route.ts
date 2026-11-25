import { connection } from "next/server";
import { jobsJson } from "@/lib/jobs-app/guard";
import { guessFromSpeech } from "@/lib/jobs-app/job-notes";
import { bearerToken, listNoteJobs, noteShortcutSecret, noteSecretOk, parseSpokenNote, saveJobNote, storedFromParsed } from "@/lib/jobs-app/job-notes-store";

export const maxDuration = 30;

export async function POST(request: Request) {
  await connection();
  if (!noteSecretOk(bearerToken(request.headers.get("authorization")), noteShortcutSecret())) {
    return jobsJson({ ok: false, error: "unauthorized", message: "That shortcut is not allowed." }, 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const text = body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text.trim() : "";
  if (!text || text.length > 2000) return jobsJson({ ok: false, error: "bad_request", message: "Say a short note first." }, 400);
  const listed = await listNoteJobs();
  const guess = listed.jobs.length > 0 ? guessFromSpeech(text, listed.jobs) : null;
  const parsed = await parseSpokenNote(text);
  const saved = await saveJobNote(
    storedFromParsed({
      text,
      parsed,
      jobId: guess?.jobId ?? "",
      type: guess ? "job" : "chore",
      needsReview: Boolean(guess),
      draft: false,
    }),
  );
  if (!saved.ok) return jobsJson({ ok: false, error: saved.status === 503 ? "unconfigured" : "upstream", message: saved.message }, saved.status);
  return jobsJson({ ok: true, pageId: saved.pageId, jobId: guess?.jobId ?? "", needsReview: Boolean(guess) });
}
