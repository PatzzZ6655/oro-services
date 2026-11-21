import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { readScreenshots } from "@/lib/jobs-app/webhooks";

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const result = await readScreenshots(form);
  return jobsJson(result.body, result.status);
}
