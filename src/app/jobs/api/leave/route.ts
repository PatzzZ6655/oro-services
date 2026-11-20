import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { leaveJob } from "@/lib/jobs-app/webhooks";

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "请求不对" }, 400);
  }
  const result = await leaveJob(form);
  return jobsJson(result.body, result.status);
}
