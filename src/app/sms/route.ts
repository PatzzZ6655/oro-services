import { australianSmsNumber, smsBridgePage } from "@/lib/sms-link";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

export function GET(request: Request): Response {
  const raw = new URL(request.url).searchParams.get("to");
  const number = raw ? australianSmsNumber(raw) : null;
  if (!number) {
    return new Response("That number is not valid.", {
      status: 400,
      headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(smsBridgePage(number), {
    status: 200,
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  });
}
