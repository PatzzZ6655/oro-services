import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { sendIntroEmail } from "@/lib/jobs-app/webhooks";
import { isBusiness } from "@/lib/jobs-app/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = input.action === "skip" ? "skip" : input.action === "send" ? "send" : "";
  const business = input.business;
  const tenants = Array.isArray(input.tenants)
    ? input.tenants
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          return {
            name: typeof row.name === "string" ? row.name : "",
            email: typeof row.email === "string" ? row.email : "",
          };
        })
        .filter((row): row is { name: string; email: string } => row !== null)
    : [];
  if (!action || !isBusiness(business)) {
    return jobsJson({ ok: false, error: "bad_request", message: "Choose send or skip." }, 400);
  }
  const result = await sendIntroEmail({
    jobId: typeof input.jobId === "string" ? input.jobId : "",
    business,
    desc: typeof input.desc === "string" ? input.desc : "",
    address: typeof input.address === "string" ? input.address : "",
    pmAgency: typeof input.pmAgency === "string" ? input.pmAgency : "",
    tenants,
    action,
  });
  return jobsJson(result.body, result.status);
}
