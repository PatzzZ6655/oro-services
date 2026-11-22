import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { tenantContactsFromNotion, tenantQuery } from "@/lib/sms-reply-jobs";

const NOTION = "test-notion-token";

function useEnv() {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.INTERNAL_SESSION_SECRET = "test-session-secret";
  process.env.INTERNAL_ALLOWED_EMAILS = "pat.z@orosvc.com";
  process.env.MAKE_SHORTCUTS_SECRET = "test-make-secret";
  process.env.MAKE_JOBS_TODAY_URL = "http://127.0.0.1:9/today";
  process.env.MAKE_DEPART_URL = "http://127.0.0.1:9/depart";
  process.env.MAKE_LEAVE_URL = "http://127.0.0.1:9/leave";
  process.env.MAKE_NEWJOB_URL = "http://127.0.0.1:9/new";
  process.env.NOTION_TOKEN = NOTION;
}

function notionPage(name: string, phone: string, role: string) {
  return {
    properties: {
      Name: { title: [{ plain_text: name }] },
      Phone: { phone_number: phone },
      Select: { select: { name: role } },
    },
  };
}

function todayBody(business: string) {
  const job =
    business === "emoro"
      ? { business, jobId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", title: "TEST kitchen leak", address: "12 Test Street", status: "Scheduled", scheduled: "09:00" }
      : { business, jobId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "TEST hot water", address: "4 Test Road", status: "Scheduled", scheduled: "11:00" };
  return { ok: true, date: "2026-11-23", jobs: [job] };
}

test("tenant contacts drop the owner and normalise the mobile", () => {
  const contacts = tenantContactsFromNotion({
    results: [
      notionPage("Test Owner", "0400 000 009", "Owner"),
      notionPage("Test Tenant", "0400 000 001", "Tenant"),
      notionPage("", "04 0000 0001", "Tenant"),
      notionPage("Test Flatmate", "0400 000 002", "Tenant"),
    ],
  });
  assert.deepEqual(contacts, [
    { name: "Test Tenant", phone: "+61400000001" },
    { name: "Test Flatmate", phone: "+61400000002" },
  ]);
  const emoro = tenantQuery("emoro", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const emporo = tenantQuery("emporo", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  assert.match(emoro.url, /d1da6a01-0507-43fc-9e3f-72a16f34a342/);
  assert.match(emporo.url, /38c91037-f9ca-80ac-bef4-c824f3e1c3ef/);
  assert.match(emoro.body, /does_not_equal/);
  assert.match(emoro.body, /"Owner"/);
  assert.match(emporo.body, /Jobs \(Plumbing\)/);
  assert.equal(emoro.body.includes("depart"), false);
});

test("the job route reads today's list and tenant contacts without writing", async () => {
  useEnv();
  const original = globalThis.fetch;
  const calls: Array<{ url: string; body: string; authorization: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = String(init?.body ?? "");
    const authorization = new Headers(init?.headers).get("authorization") ?? "";
    calls.push({ url, body, authorization });
    assert.equal(body.includes(NOTION), false);
    if (url.includes("api.notion.com")) {
      return Response.json({
        results: [notionPage("Test Tenant", "0400 000 001", "Tenant"), notionPage("Test Owner", "0400 000 009", "Owner")],
      });
    }
    const posted = JSON.parse(body) as { business?: string };
    return Response.json(todayBody(posted.business ?? "emoro"));
  };
  try {
    const { POST } = await import("@/app/internal/api/sms-reply/jobs/route");
    const token = await signSession("pat.z@orosvc.com", "Pat");
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
    const ask = (payload: unknown) =>
      POST(
        new Request("https://www.orosvc.com/internal/api/sms-reply/jobs", {
          method: "POST",
          headers: { origin: "https://www.orosvc.com", cookie, "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );

    const signedOut = await POST(
      new Request("https://www.orosvc.com/internal/api/sms-reply/jobs", {
        method: "POST",
        headers: { origin: "https://www.orosvc.com", "content-type": "application/json" },
        body: "{}",
      }),
    );
    assert.equal(signedOut.status, 401);
    assert.equal(calls.length, 0);

    const listed = await ask({});
    const listedBody = (await listed.json()) as { ok: boolean; jobs: Array<{ title: string; business: string }> };
    assert.equal(listed.status, 200);
    assert.deepEqual(
      listedBody.jobs.map((job) => job.title),
      ["TEST kitchen leak", "TEST hot water"],
    );
    assert.equal(calls.every((call) => call.url === "http://127.0.0.1:9/today"), true);

    const picked = await ask({ business: "emoro", jobId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
    const pickedBody = (await picked.json()) as { ok: boolean; contacts: Array<{ name: string; phone: string }> };
    assert.equal(picked.status, 200);
    assert.deepEqual(pickedBody.contacts, [{ name: "Test Tenant", phone: "+61400000001" }]);
    assert.equal(calls.some((call) => call.url.includes("/depart")), false);
    assert.equal(calls.some((call) => call.url.includes("/leave")), false);
    assert.equal(calls.some((call) => call.url.includes("/new")), false);
    const notion = calls.find((call) => call.url.includes("api.notion.com"));
    assert.equal(notion?.authorization, `Bearer ${NOTION}`);
    assert.match(notion?.body ?? "", /does_not_equal/);

    const form = readFileSync(new URL("../src/components/internal/sms-reply-form.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../src/app/internal/api/sms-reply/jobs/route.ts", import.meta.url), "utf8");
    assert.match(form, /Show jobs/);
    assert.match(form, /Tenant contact/);
    assert.equal(form.includes("/jobs/api/depart"), false);
    assert.equal(form.includes("MAKE_DEPART"), false);
    assert.equal(route.includes("departJob"), false);
    assert.equal(route.includes("console."), false);
  } finally {
    globalThis.fetch = original;
    delete process.env.NOTION_TOKEN;
  }
});
