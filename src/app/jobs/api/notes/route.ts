import { connection } from "next/server";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { normaliseNote, type ParsedNote } from "@/lib/jobs-app/job-notes";
import { bearerToken, noteReadSecret, noteSecretOk, readJobNotes, saveJobNote, storedFromParsed } from "@/lib/jobs-app/job-notes-store";

export const maxDuration = 30;

function parsedBody(value: unknown): ParsedNote {
  return normaliseNote(value);
}

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
  if (!text) return jobsJson({ ok: false, error: "bad_request", message: "Say a short note first." }, 400);
  const jobId = typeof input.jobId === "string" ? input.jobId : "";
  const type = jobId ? "job" : "chore";
  const saved = await saveJobNote(
    storedFromParsed({
      text,
      parsed: parsedBody(input.parsed),
      jobId,
      type,
      needsReview: input.needsReview === true,
      draft: input.draft === true,
    }),
  );
  if (!saved.ok) return jobsJson({ ok: false, error: saved.status === 503 ? "unconfigured" : "upstream", message: saved.message }, saved.status);
  return jobsJson({ ok: true, pageId: saved.pageId });
}

export async function GET(request: Request) {
  await connection();
  if (!noteSecretOk(bearerToken(request.headers.get("authorization")), noteReadSecret())) {
    return jobsJson({ ok: false, error: "unauthorized", message: "Sign in again." }, 401);
  }
  const url = new URL(request.url);
  const openTodos = url.searchParams.get("openTodos") === "1";
  const jobId = url.searchParams.get("jobId") ?? "";
  const read = await readJobNotes(openTodos ? { openTodos: true } : { jobId });
  if (!read.ok) return jobsJson({ ok: false, error: read.status === 503 ? "unconfigured" : "upstream", message: read.message }, read.status);
  return jobsJson({ ok: true, notes: read.notes });
}
