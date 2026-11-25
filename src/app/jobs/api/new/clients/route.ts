import { findAgencyClients } from "@/lib/jobs-app/clients";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { isBusiness } from "@/lib/jobs-app/types";

export const maxDuration = 20;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const business = typeof row.business === "string" ? row.business : "";
  if (!isBusiness(business)) return jobsJson({ ok: false, error: "bad_request", message: "Choose Emoro or Emporo." }, 400);
  const agency = typeof row.agency === "string" ? row.agency : "";
  const hint = typeof row.hint === "string" ? row.hint : "";
  const found = await findAgencyClients(business, agency, hint);
  return jobsJson({ ok: true, pick: found.pick, suggestions: found.suggestions });
}
