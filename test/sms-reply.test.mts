import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import {
  SMS_GEMINI_MODEL,
  SMS_REPLY_LIMIT,
  allowSmsReply,
  cleanSmsDraft,
  geminiSmsBody,
  geminiSmsUrl,
  parseSmsReply,
  readGeminiSms,
  resetSmsReplyLimits,
  smsBodyHref,
  smsReplyPrompt,
  writeEnglishSms,
} from "@/lib/sms-reply";

const KEY = "test-gemini-key";

function useEnv() {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.INTERNAL_SESSION_SECRET = "test-session-secret";
  process.env.INTERNAL_ALLOWED_EMAILS = "pat.z@orosvc.com";
  process.env.GEMINI_SMS_API_KEY = KEY;
}

test("the prompt keeps the tradie rules and only the facts Pat gave", () => {
  const prompt = smsReplyPrompt({
    customerMessage: "Can you come Tuesday?",
    intent: "说明周二下午可以，不要报价",
    brand: "emoro",
    customerName: "Sam",
  });
  assert.match(prompt.system, /Australian construction boss/);
  assert.match(prompt.system, /Do not promise a response time/);
  assert.match(prompt.system, /Do not mention a price, quote, discount, or voucher unless Pat's intent states it/);
  assert.match(prompt.system, /Add a sign-off only if Pat's intent asks for one/);
  assert.match(prompt.system, /Never invent/);
  assert.match(prompt.system, /Output only the SMS text/);
  assert.match(prompt.system, /You never send a message/);
  assert.equal(prompt.system.includes("Can you come Tuesday?"), false);
  assert.match(prompt.user, /Can you come Tuesday\?/);
  assert.match(prompt.user, /说明周二下午可以，不要报价/);
  assert.match(prompt.user, /Brand: Emoro Building/);
  assert.match(prompt.user, /Customer name: Sam/);
  assert.equal(prompt.user.includes(KEY), false);
  assert.equal(prompt.system.includes("Emporo"), false);

  const blank = smsReplyPrompt({ customerMessage: "  ", intent: "回他明天再联系", brand: "", customerName: " " });
  assert.match(blank.user, /\(none pasted\)/);
  assert.match(blank.user, /回他明天再联系/);
  assert.match(blank.user, /Brand: not specified/);
  assert.match(blank.user, /Customer name: not given/);
  assert.equal(blank.user.includes("Emoro"), false);
  assert.equal(blank.user.includes("Emporo"), false);

  const body = geminiSmsBody(prompt);
  assert.equal(body.systemInstruction.parts[0]?.text, prompt.system);
  assert.equal(body.contents[0]?.parts[0]?.text, prompt.user);
  assert.equal(geminiSmsUrl().includes(SMS_GEMINI_MODEL), true);
  assert.equal(geminiSmsUrl().includes("key="), false);
  assert.equal(smsBodyHref("See you Tuesday."), "sms:&body=See%20you%20Tuesday.");
});

test("draft text drops labels, quotes, thoughts, and a runaway reply", () => {
  assert.equal(cleanSmsDraft('  "Tuesday afternoon works. Thanks."  '), "Tuesday afternoon works. Thanks.");
  assert.equal(cleanSmsDraft("```text\nHi Sam, Tuesday is fine.\n```"), "Hi Sam, Tuesday is fine.");
  assert.equal(cleanSmsDraft("SMS: We'll swing by Tuesday afternoon."), "We'll swing by Tuesday afternoon.");
  const long = `${"Thanks. ".repeat(80)}The end is here.`;
  assert.equal(cleanSmsDraft(long).length <= 480, true);
  assert.equal(
    readGeminiSms({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "I should invent a price of $200." },
              { text: '"Hi Sam, Tuesday afternoon works."' },
            ],
          },
        },
      ],
    }),
    "Hi Sam, Tuesday afternoon works.",
  );
  assert.equal(readGeminiSms({ candidates: [{ content: { parts: [{ thought: true, text: "hidden" }] } }] }), null);
  assert.equal(parseSmsReply({ intent: "  " }).ok, false);
  assert.equal(parseSmsReply({ intent: "回他", brand: "other" }).ok, false);
  const parsed = parseSmsReply({ intent: "回他可以", brand: "emporo", customerName: " Lee ", customerMessage: "When?" });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.brand, "emporo");
    assert.equal(parsed.value.customerName, "Lee");
  }
});

test("the reply route requires the staff session and keeps the Gemini key out of the prompt", async () => {
  useEnv();
  resetSmsReplyLimits();
  const original = globalThis.fetch;
  const calls: Array<{ url: string; headers: Headers; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), headers, body: String(init?.body ?? "") });
    assert.equal(headers.get("x-goog-api-key"), KEY);
    assert.equal(String(input).includes(KEY), false);
    assert.equal(String(init?.body ?? "").includes(KEY), false);
    return Response.json({
      candidates: [{ content: { parts: [{ text: '"Hi Sam, Tuesday afternoon works. Thanks."' }] } }],
    });
  };
  try {
    const { POST } = await import("@/app/internal/api/sms-reply/route");
    const token = await signSession("pat.z@orosvc.com", "Pat");
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
    const ask = (headers: Record<string, string>, body: unknown) =>
      POST(
        new Request("https://www.orosvc.com/internal/api/sms-reply", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
      );

    const signedOut = await ask({ origin: "https://www.orosvc.com", "content-type": "application/json" }, { intent: "回他" });
    assert.equal(signedOut.status, 401);
    assert.equal(calls.length, 0);

    const wrongSite = await ask(
      { origin: "https://evil.example", cookie, "content-type": "application/json" },
      { intent: "回他" },
    );
    assert.equal(wrongSite.status, 403);
    assert.equal(calls.length, 0);

    const empty = await ask({ origin: "https://www.orosvc.com", cookie, "content-type": "application/json" }, { intent: " " });
    assert.equal(empty.status, 400);
    assert.equal(calls.length, 0);

    const written = await ask(
      { origin: "https://www.orosvc.com", cookie, "content-type": "application/json" },
      { customerMessage: "Can you come Tuesday?", intent: "说明周二下午可以", brand: "emoro", customerName: "Sam" },
    );
    const writtenBody = (await written.json()) as { ok: boolean; sms: string };
    assert.equal(written.status, 200);
    assert.equal(writtenBody.sms, "Hi Sam, Tuesday afternoon works. Thanks.");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, geminiSmsUrl());
    assert.match(calls[0]?.body ?? "", /说明周二下午可以/);
    assert.match(calls[0]?.body ?? "", /Emoro Building/);

    delete process.env.GEMINI_SMS_API_KEY;
    const unconfigured = await ask(
      { origin: "https://www.orosvc.com", cookie, "content-type": "application/json" },
      { intent: "回他一声" },
    );
    const unconfiguredBody = (await unconfigured.json()) as { message: string };
    assert.equal(unconfigured.status, 503);
    assert.equal(unconfiguredBody.message.includes(KEY), false);
    assert.equal(calls.length, 1);
    process.env.GEMINI_SMS_API_KEY = KEY;

    globalThis.fetch = async () => new Response("no", { status: 500 });
    const failed = await ask(
      { origin: "https://www.orosvc.com", cookie, "content-type": "application/json" },
      { intent: "回他一声" },
    );
    const failedBody = (await failed.json()) as { message: string };
    assert.equal(failed.status, 502);
    assert.equal(failedBody.message.includes(KEY), false);

    resetSmsReplyLimits();
    for (let i = 0; i < SMS_REPLY_LIMIT; i += 1) assert.equal(allowSmsReply("pat.z@orosvc.com"), true);
    const limited = await ask(
      { origin: "https://www.orosvc.com", cookie, "content-type": "application/json" },
      { intent: "再写一次" },
    );
    assert.equal(limited.status, 429);

    const route = readFileSync(new URL("../src/app/internal/api/sms-reply/route.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../src/app/internal/(portal)/sms-reply/page.tsx", import.meta.url), "utf8");
    const hub = readFileSync(new URL("../src/app/internal/(portal)/page.tsx", import.meta.url), "utf8");
    const menu = readFileSync(new URL("../src/lib/content.ts", import.meta.url), "utf8");
    const form = readFileSync(new URL("../src/components/internal/sms-reply-form.tsx", import.meta.url), "utf8");
    assert.equal(route.includes("console."), false);
    assert.equal(route.includes("MAKE_"), false);
    assert.match(page, /requireUser/);
    assert.match(hub, /href="\/internal\/sms-reply"/);
    assert.equal(menu.includes("sms-reply"), false);
    assert.equal(menu.includes("SMS reply"), false);
    assert.match(form, /Write English/);
    assert.match(form, /Open in Messages/);
    assert.match(form, /smsBodyHref/);
    assert.equal(form.includes("GEMINI"), false);
  } finally {
    globalThis.fetch = original;
    resetSmsReplyLimits();
    process.env.GEMINI_SMS_API_KEY = KEY;
  }
});

test("a Gemini miss does not echo the key", async () => {
  process.env.GEMINI_SMS_API_KEY = KEY;
  const missed = await writeEnglishSms(
    { customerMessage: "", intent: "回他", brand: "", customerName: "" },
    async () => Response.json({ candidates: [] }),
  );
  assert.equal(missed.ok, false);
  if (!missed.ok) assert.equal(missed.message.includes(KEY), false);
});
