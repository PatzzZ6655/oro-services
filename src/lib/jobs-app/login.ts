import { jobsJson, originDenied } from "@/lib/jobs-app/guard";
import { clearLoginFailures, clientKey, jobsPassword, loginAllowed, passwordsMatch, recordLoginFailure } from "@/lib/jobs-app/password";
import { jobsSessionSecret, serializeJobsCookie, signJobsSession } from "@/lib/jobs-app/session";

export async function attemptLogin(request: Request): Promise<Response> {
  const denied = originDenied(request);
  if (denied) return denied;
  const password = jobsPassword();
  const secret = jobsSessionSecret();
  if (!password || !secret) return jobsJson({ ok: false, error: "unconfigured", message: "服务器还没配好。" }, 503);

  const key = clientKey(request.headers);
  if (!loginAllowed(key)) return jobsJson({ ok: false, error: "limited", message: "试太多次了，请过几分钟再试。" }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordLoginFailure(key);
    return jobsJson({ ok: false, error: "invalid", message: "密码不对" }, 401);
  }
  const given = body && typeof body === "object" && "password" in body && typeof body.password === "string" ? body.password : "";
  if (!(await passwordsMatch(given, password))) {
    recordLoginFailure(key);
    return jobsJson({ ok: false, error: "invalid", message: "密码不对" }, 401);
  }

  clearLoginFailures(key);
  const response = jobsJson({ ok: true });
  response.headers.append("set-cookie", serializeJobsCookie(await signJobsSession()));
  return response;
}
