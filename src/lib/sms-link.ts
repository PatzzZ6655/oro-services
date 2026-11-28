/** Australian mobile or geographic landline, as sms:+61 and nine digits. */
export function australianSmsNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 22) return null;
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return null;
  const compact = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]+$/.test(compact)) return null;
  let digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (digits.startsWith("0")) digits = `61${digits.slice(1)}`;
  if (!/^61[23478][0-9]{8}$/.test(digits)) return null;
  return `+${digits}`;
}

const privateHeaders = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

/** Spoken SMS text. Control characters are removed; longer text is refused. */
export const smsBodyLimit = 300;

export function smsMessageBody(input: string, limit = smsBodyLimit): string | null {
  if (input.length > limit * 4) return null;
  const cleaned = input.replace(/[\p{Cc}]/gu, "").trim();
  if (cleaned.length > limit) return null;
  return cleaned;
}

export function smsLinkResponse(url: string): Response {
  const params = new URL(url).searchParams;
  const raw = params.get("to");
  const number = raw ? australianSmsNumber(raw) : null;
  if (!number) {
    return new Response("That number is not valid.", {
      status: 400,
      headers: { ...privateHeaders, "content-type": "text/plain; charset=utf-8" },
    });
  }
  const rawBody = params.get("body");
  const body = rawBody ? smsMessageBody(rawBody) : "";
  if (rawBody && body === null) {
    return new Response("That message is too long.", {
      status: 400,
      headers: { ...privateHeaders, "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(smsBridgePage(number, body ?? ""), {
    status: 200,
    headers: { ...privateHeaders, "content-type": "text/html; charset=utf-8" },
  });
}

export function smsBridgePage(number: string, body = ""): string {
  const href = body ? `sms:${number}?&body=${encodeURIComponent(body)}` : `sms:${number}`;
  const attr = href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url=${attr}">
<title>Open Messages</title>
</head>
<body>
<p><a href="${attr}">Open Messages</a></p>
<script>location.replace(${JSON.stringify(href)})</script>
</body>
</html>`;
}
