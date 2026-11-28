import { connection } from "next/server";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { readPhotoFile } from "@/lib/jobs-app/photo-drive";

export const maxDuration = 30;

export async function GET(request: Request) {
  await connection();
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return jobsJson({ ok: false, message: "That photo could not be opened." }, 400);
  const bytes = await readPhotoFile(id);
  if (!bytes) return jobsJson({ ok: false, message: "That photo could not be opened." }, 404);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
