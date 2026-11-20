import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { listToday } from "@/lib/jobs-app/webhooks";

export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  const result = await listToday();
  return jobsJson(result.body, result.status);
}
