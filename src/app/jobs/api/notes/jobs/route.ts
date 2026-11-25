import { connection } from "next/server";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { listNoteJobs } from "@/lib/jobs-app/job-notes-store";
import { melbourneYmd } from "@/lib/jobs-app/note-groups";

export const maxDuration = 30;

export async function POST(request: Request) {
  await connection();
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  const listed = await listNoteJobs();
  if (listed.status !== 200) return jobsJson({ ok: false, error: "upstream", message: listed.message }, listed.status);
  return jobsJson({ ok: true, today: melbourneYmd(new Date()), jobs: listed.jobs });
}
