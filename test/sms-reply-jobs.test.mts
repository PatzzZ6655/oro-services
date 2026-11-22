import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { smsAddressKey } from "@/lib/sms-address";
import { readGeminiShot } from "@/lib/sms-reply";
import { isSmsTestJob, smsIncludeTestJobs, smsJobStage } from "@/lib/sms-job-statuses";
import {
  jobsFromNotion,
  jobsQuery,
  keepActiveSmsJobs,
  matchActiveSmsJobs,
  matchJobsByPhone,
  phoneLinksFromNotion,
  planTenantSave,
  tenantContactsFromNotion,
  tenantCreateBody,
  tenantPagesFromNotion,
  tenantQuery,
  type SmsOpenJob,
} from "@/lib/sms-reply-jobs";

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

const OLD = "11111111-1111-1111-1111-111111111111";
const ACTIVE = "22222222-2222-2222-2222-222222222222";
const EMPTY = "33333333-3333-3333-3333-333333333333";
const SAME = "Unit 4/12 Test Street, Doncaster East VIC 3109";

function statusNames(body: string): string[] {
  const parsed = JSON.parse(body) as { filter: { or: Array<{ select: { equals: string } }> } };
  return parsed.filter.or.map((item) => item.select.equals);
}

function notionJob(id: string, title: string, address: string, status: string) {
  return {
    id,
    properties: {
      Job: { title: [{ plain_text: title }] },
      Status: { select: { name: status } },
      "Scheduled Date": { date: { start: "2026-11-25T09:00:00.000+11:00" } },
      "Property Address (rollup)": { rollup: { array: [{ title: [{ plain_text: address }] }] } },
      "Address Rollup": { rollup: { array: [{ title: [{ plain_text: address }] }] } },
    },
  };
}

function emoroJobs() {
  return [
    notionJob(OLD, "Kitchen leak", SAME, "Complete"),
    notionJob(ACTIVE, "TEST_ kitchen leak", "12 Test St, Doncaster East", "New Work Order"),
    notionJob("44444444-4444-4444-4444-444444444444", "TEST_ other", "9 Other Road, Fitzroy", "Quoting"),
  ];
}

const activePair: SmsOpenJob[] = [
  { business: "emoro", jobId: OLD, title: "Kitchen leak", address: SAME, status: "Complete", scheduled: "2024-01-01" },
  { business: "emoro", jobId: ACTIVE, title: "TEST_ kitchen leak", address: "12 Test St, Doncaster East", status: "New Work Order", scheduled: "2026-11-25T09:00:00+11:00" },
  { business: "emoro", jobId: "44444444-4444-4444-4444-444444444444", title: "Cancelled tap", address: SAME, status: "Cancelled", scheduled: "" },
];

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

test("an address match keeps the active job and drops the finished one at the same address", () => {
  assert.equal(smsAddressKey("12 Test St, Doncaster East"), "12 test street");
  assert.equal(smsAddressKey(SAME), "12 test street");
  assert.equal(smsAddressKey("9 Other Rd"), "9 other road");
  const matched = matchActiveSmsJobs("12 test street doncaster", activePair);
  assert.deepEqual(matched.map((job) => job.jobId), [ACTIVE]);
  assert.equal(matchActiveSmsJobs("9 Other Road, Fitzroy VIC", activePair).length, 0);
  const parsed = jobsFromNotion({ results: emoroJobs() }, "emoro");
  assert.equal(parsed.some((job) => job.status === "Complete"), true);
  assert.deepEqual(keepActiveSmsJobs(parsed).map((job) => job.status).sort(), ["New Work Order", "Quoting"]);
  assert.equal(isSmsTestJob("TEST_ kitchen leak"), true);
  assert.equal(isSmsTestJob("Testing the tap"), false);
  assert.deepEqual(keepActiveSmsJobs(parsed, false).map((job) => job.jobId), []);
  assert.equal(smsIncludeTestJobs({ VERCEL_ENV: "production" }), false);
  assert.equal(smsIncludeTestJobs({ VERCEL_ENV: "preview" }), true);
  const emoro = jobsQuery("emoro");
  const emporo = jobsQuery("emporo");
  assert.match(emoro.body, /New Work Order/);
  assert.match(emoro.body, /Contacting Tenant 3 Cc PM/);
  assert.match(emoro.body, /In Progress \(Return Key\)/);
  assert.match(emoro.body, /Quoting \(Collect Key\)/);
  assert.equal(emoro.body.includes("Complete"), false);
  assert.equal(emoro.body.includes("Cancelled"), false);
  assert.equal(emoro.body.includes("on_or_before"), false);
  assert.equal(emporo.body.includes("In Progress (Return Key)"), false);
  assert.equal(emporo.body.includes("Quoting (Collect Key)"), false);
  const emoroNames = statusNames(emoro.body);
  const emporoNames = statusNames(emporo.body);
  for (const name of ["In Progress (Collect Key)", "In Progress", "In Progress (Waiting)", "In Progress (Purchase Material)", "In Progress (Customer Service)", "In Progress (Return Key)"]) {
    assert.equal(emoroNames.includes(name), true, name);
  }
  assert.deepEqual(
    emporoNames.filter((name) => name.toLowerCase().startsWith("in progress")),
    ["In Progress", "In Progress (Purchase Material)"],
  );
  assert.equal(emoroNames.includes("Complete") || emporoNames.includes("Cancelled"), false);
  assert.ok(smsJobStage("Job Key Appointing") < smsJobStage("In Progress"));
  assert.ok(smsJobStage("In Progress") < smsJobStage("In Progress (Return Key)"));
});

test("a bare mobile matches the active job, not an older job at the same address", () => {
  const links = phoneLinksFromNotion(
    {
      results: [
        {
          properties: {
            Name: { title: [{ plain_text: "Old tenant" }] },
            Phone: { phone_number: "0400 000 001" },
            Select: { select: { name: "Tenant" } },
            Jobs: { relation: [{ id: OLD }] },
          },
        },
        {
          properties: {
            Name: { title: [{ plain_text: "New tenant" }] },
            Phone: { phone_number: "+61400000001" },
            Select: { select: { name: "Tenant" } },
            Jobs: { relation: [{ id: ACTIVE }] },
          },
        },
        {
          properties: {
            Name: { title: [{ plain_text: "Owner" }] },
            Phone: { phone_number: "+61400000001" },
            Select: { select: { name: "Owner" } },
            Jobs: { relation: [{ id: ACTIVE }] },
          },
        },
      ],
    },
    "emoro",
  );
  const matched = matchJobsByPhone("0400 000 001", activePair, links);
  assert.deepEqual(matched.map((job) => job.jobId), [ACTIVE]);
  const facts = readGeminiShot({
    candidates: [{ content: { parts: [{ text: '{"address":"","phone":"0400 000 001","name":"0400 000 001"}' }] } }],
  });
  assert.equal(facts.address, "");
  assert.equal(facts.phone, "+61400000001");
  assert.equal(facts.name, "");
  const addressed = readGeminiShot({
    candidates: [{ content: { parts: [{ text: '{"address":"12 Test St, Doncaster","phone":"0411 111 111","name":""}' }] } }],
  });
  assert.equal(addressed.address, "12 Test St, Doncaster");
  assert.equal(addressed.phone, "+61411111111");
});

test("saving a number fills an empty tenant phone or creates a contact, and never touches the property", () => {
  const empty = tenantPagesFromNotion({
    results: [
      { id: EMPTY, properties: { Name: { title: [{ plain_text: "Pat Tenant" }] }, Phone: { phone_number: null }, Select: { select: { name: "Tenant" } } } },
      { id: "55555555-5555-5555-5555-555555555555", properties: { Name: { title: [{ plain_text: "Owner" }] }, Phone: { phone_number: "" }, Select: { select: { name: "Owner" } } } },
    ],
  });
  assert.deepEqual(planTenantSave("+61400000003", empty), { action: "update", pageId: EMPTY });
  const taken = [{ pageId: ACTIVE, name: "New tenant", phone: "+61400000001" }];
  assert.deepEqual(planTenantSave("0400 000 009", taken), { action: "create" });
  assert.deepEqual(planTenantSave("+61400000001", taken), { action: "already" });
  const created = tenantCreateBody("emoro", ACTIVE, "+61400000009", "");
  const encoded = JSON.stringify(created);
  assert.equal(encoded.includes("Property"), false);
  assert.match(encoded, /"Jobs"/);
  assert.match(encoded, /Tenant/);
  assert.match(encoded, /"Tenant"/);
  assert.equal(encoded.includes("Properties (Plumbing)"), false);
  const named = JSON.stringify(tenantCreateBody("emporo", ACTIVE, "+61400000009", "Sam"));
  assert.match(named, /Jobs \(Plumbing\)/);
  assert.match(named, /Sam/);
  assert.equal(named.includes("Property"), false);
});

test("the job route reads active jobs and writes a tenant number only when asked", async () => {
  useEnv();
  process.env.GEMINI_SMS_API_KEY = "test-gemini-key";
  delete process.env.VERCEL_ENV;
  const original = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: string }> = [];
  let gemini = '{"address":"12 Test St, Doncaster East","phone":"0499 000 111","name":""}';
  let tenants: unknown[] = [notionPage("New tenant", "0400 000 001", "Tenant")];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = String(init?.body ?? "");
    calls.push({ url, method, body });
    assert.equal(body.includes(NOTION), false);
    if (url.includes("127.0.0.1")) throw new Error("the job list must not call Make");
    if (url.includes("generativelanguage")) {
      return Response.json({ candidates: [{ content: { parts: [{ text: gemini }] } }] });
    }
    if (url.includes("ff086255-3e2c-4e2b-a462-fe183e32b1ba")) return Response.json({ results: emoroJobs() });
    if (url.includes("38c91037-f9ca-80fd-a313-d6833c2e589d")) return Response.json({ results: [] });
    if (url.includes("d1da6a01-0507-43fc-9e3f-72a16f34a342") || url.includes("38c91037-f9ca-80ac-bef4-c824f3e1c3ef")) {
      if (body.includes("phone_number")) {
        return Response.json({
          results: [
            {
              properties: {
                Name: { title: [{ plain_text: "New tenant" }] },
                Phone: { phone_number: "+61400000001" },
                Select: { select: { name: "Tenant" } },
                Jobs: { relation: [{ id: ACTIVE }, { id: OLD }] },
              },
            },
          ],
        });
      }
      return Response.json({ results: tenants });
    }
    if (url.startsWith("https://api.notion.com/v1/pages")) {
      assert.equal(body.includes("Property"), false);
      return Response.json({ id: "saved" });
    }
    throw new Error(`unexpected ${method} ${url}`);
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
    const listedBody = (await listed.json()) as { ok: boolean; jobs: Array<{ jobId: string; status: string }> };
    assert.equal(listed.status, 200);
    assert.deepEqual(
      listedBody.jobs.map((job) => job.jobId),
      [ACTIVE, "44444444-4444-4444-4444-444444444444"],
    );
    assert.equal(listedBody.jobs.some((job) => job.status === "Complete" || job.status === "Cancelled"), false);
    assert.equal(calls.some((call) => call.url.includes("/depart") || call.url.includes("/leave") || call.url.includes("/v1/pages")), false);

    const picked = await ask({ business: "emoro", jobId: ACTIVE });
    const pickedBody = (await picked.json()) as { ok: boolean; contacts: Array<{ name: string; phone: string }> };
    assert.equal(picked.status, 200);
    assert.equal(pickedBody.contacts[0]?.phone, "+61400000001");
    const closed = await ask({ business: "emoro", jobId: OLD });
    assert.equal(closed.status, 404);

    calls.length = 0;
    const shot = "a".repeat(64);
    const addressed = await ask({ image: { mimeType: "image/jpeg", data: shot } });
    const addressedBody = (await addressed.json()) as { ok: boolean; matchedBy: string; matches: Array<{ jobId: string }> };
    assert.equal(addressed.status, 200);
    assert.equal(addressedBody.matchedBy, "address");
    assert.deepEqual(addressedBody.matches.map((job) => job.jobId), [ACTIVE]);

    gemini = '{"address":"","phone":"0400 000 001","name":""}';
    const numbered = await ask({ image: { mimeType: "image/jpeg", data: shot } });
    const numberedBody = (await numbered.json()) as { ok: boolean; matchedBy: string; phone: string; matches: Array<{ jobId: string }> };
    assert.equal(numbered.status, 200);
    assert.equal(numberedBody.matchedBy, "phone");
    assert.equal(numberedBody.phone, "+61400000001");
    assert.deepEqual(numberedBody.matches.map((job) => job.jobId), [ACTIVE]);

    tenants = [
      { id: EMPTY, properties: { Name: { title: [{ plain_text: "New tenant" }] }, Phone: { phone_number: null }, Select: { select: { name: "Tenant" } } } },
    ];
    calls.length = 0;
    const updated = await ask({ save: true, business: "emoro", jobId: ACTIVE, phone: "0499 000 222", name: "Sam" });
    const updatedBody = (await updated.json()) as { ok: boolean; action: string };
    assert.equal(updated.status, 200);
    assert.equal(updatedBody.action, "updated");
    const patch = calls.find((call) => call.method === "PATCH");
    assert.match(patch?.url ?? "", new RegExp(EMPTY));
    assert.match(patch?.body ?? "", /phone_number/);
    assert.equal(patch?.body.includes("Property"), false);
    assert.equal(patch?.body.includes("Name"), false);

    tenants = [notionPage("New tenant", "0400 000 001", "Tenant")];
    calls.length = 0;
    const created = await ask({ save: true, business: "emoro", jobId: ACTIVE, phone: "0499 000 333", name: "" });
    const createdBody = (await created.json()) as { ok: boolean; action: string };
    assert.equal(created.status, 200);
    assert.equal(createdBody.action, "created");
    const post = calls.find((call) => call.method === "POST" && call.url.endsWith("/v1/pages"));
    assert.match(post?.body ?? "", /"Jobs"/);
    assert.match(post?.body ?? "", /"Tenant"/);
    assert.equal((post?.body ?? "").includes("Property"), false);
    assert.equal(calls.some((call) => call.url.includes("api.notion.com") && call.body.includes('"Property"')), false);

    const form = readFileSync(new URL("../src/components/internal/sms-reply-form.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../src/app/internal/api/sms-reply/jobs/route.ts", import.meta.url), "utf8");
    assert.match(form, /Job \(optional\)/);
    assert.match(form, /Matched from screenshot/);
    assert.match(form, /No active job found/);
    assert.match(form, /This number isn't in Notion for this job/);
    assert.match(form, /Save to this job's tenant/);
    assert.match(form, /Confirm save/);
    assert.equal(form.includes("/jobs/api/depart"), false);
    assert.equal(route.includes("departJob"), false);
    assert.equal(route.includes("console."), false);
  } finally {
    globalThis.fetch = original;
    delete process.env.NOTION_TOKEN;
    delete process.env.GEMINI_SMS_API_KEY;
  }
});
