import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { isBusiness } from "@/lib/jobs-app/types";
import { cleanJobId, departJob } from "@/lib/jobs-app/webhooks";

export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "请求不对" }, 400);
  }
  const record = body && typeof body === "object" ? (body as { business?: unknown; jobId?: unknown }) : {};
  const jobId = cleanJobId(record.jobId);
  if (!isBusiness(record.business) || !jobId) {
    return jobsJson({ ok: false, error: "bad_request", message: "请求不对" }, 400);
  }
  const result = await departJob(record.business, jobId);
  return jobsJson(result.body, result.status);
}
