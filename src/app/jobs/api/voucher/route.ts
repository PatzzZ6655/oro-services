import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { isBusiness } from "@/lib/jobs-app/types";
import { applyVoucher } from "@/lib/jobs-app/webhooks";

export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  if (!body || typeof body !== "object") {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const { jobRef, code, business } = body as { jobRef?: unknown; code?: unknown; business?: unknown };
  if (typeof jobRef !== "string" || typeof code !== "string" || !isBusiness(business)) {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const result = await applyVoucher(jobRef, code, business);
  return jobsJson(result.body, result.status);
}
