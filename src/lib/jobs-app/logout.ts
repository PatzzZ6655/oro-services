import { originDenied } from "@/lib/jobs-app/guard";
import { publicOrigin } from "@/lib/jobs-app/origin";
import { JOBS_COOKIE, jobsCookieOptions, serializeJobsCookie } from "@/lib/jobs-app/session";

export function logoutResponse(request: Request): Response {
  const denied = originDenied(request);
  if (denied) return denied;
  const response = new Response(null, {
    status: 303,
    headers: {
      location: new URL("/jobs/login", publicOrigin(request)).toString(),
      "cache-control": "private, no-store",
    },
  });
  response.headers.append("set-cookie", serializeJobsCookie(JOBS_COOKIE, "", jobsCookieOptions(0)));
  return response;
}
