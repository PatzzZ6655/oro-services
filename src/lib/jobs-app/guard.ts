import { publicOrigin } from "@/lib/jobs-app/origin";
import { jobsCookieValue, readJobsSession } from "@/lib/jobs-app/session";
import type { JobsError } from "@/lib/jobs-app/types";

export function jobsJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export function originDenied(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== publicOrigin(request)) {
    return jobsJson({ ok: false, error: "forbidden", message: "That request came from the wrong site." } satisfies JobsError, 403);
  }
  return null;
}

export async function requireJobsUser(request: Request): Promise<Response | null> {
  const denied = originDenied(request);
  if (denied) return denied;
  const session = await readJobsSession(jobsCookieValue(request));
  if (!session) return jobsJson({ ok: false, error: "unauthorized", message: "Sign in again." } satisfies JobsError, 401);
  return null;
}
