export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";
  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost)) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : url.protocol.replace(":", "");
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}
