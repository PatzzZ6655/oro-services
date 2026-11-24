import assert from "node:assert/strict";
import test from "node:test";
import { matchAgencyClients, type AgencyClient } from "@/lib/jobs-app/client-match";
import { isAgencyOfficeAddress, jobPropertyAddress } from "@/lib/jobs-app/property-address";
import { JOBS_COOKIE, signJobsSession } from "@/lib/jobs-app/session";

const barry: AgencyClient[] = [
  { id: "darren", name: "Barry Plant - Darren Wang", company: "Barry Plant Eastern Group", address: "42 Stradella Ave, Vermont South" },
  { id: "jane", name: "Barry Plant - Jane Gao", company: "Barry Plant Eastern Group", address: "9 Fayette Ct, Wheelers Hill" },
  { id: "eastern", name: "Barry Plant - Eastern Group", company: "", address: "" },
  { id: "doncaster", name: "Barry Plant Doncaster", company: "Barry Plant Doncaster", address: "Doncaster" },
];

test("a Barry Plant letterhead address is not the job property", () => {
  const office = "518 Whitehorse Road, Mitcham VIC, Aus…";
  assert.equal(isAgencyOfficeAddress(office, "Barry Plant"), true);
  assert.equal(jobPropertyAddress(office, { agency: "Barry Plant" }), "");
  assert.equal(jobPropertyAddress(office), "");
  assert.equal(jobPropertyAddress("12 Smith Street, Richmond VIC 3121", { agency: "Barry Plant" }), "12 Smith Street, Richmond VIC 3121");
  assert.equal(jobPropertyAddress("Barry Plant ABN 12 345 678 901, 518 Whitehorse Road", { agency: "Barry Plant" }), "");
  assert.equal(jobPropertyAddress("Call 0400 000 000 at the office", { agency: "Barry Plant" }), "");
});

test("Barry Plant matches existing clients and only preselects one confident branch", () => {
  const several = matchAgencyClients("Barry Plant", "518 Whitehorse Road, Mitcham VIC", barry);
  assert.equal(several.pick, null);
  assert.equal(several.suggestions.length > 1, true);

  const branch = matchAgencyClients("Barry Plant", "10 Jackson Court, Doncaster VIC", barry);
  assert.equal(branch.pick?.id, "doncaster");

  const exact = matchAgencyClients("Ray White", "", [{ id: "rw", name: "Ray White", company: "", address: "" }]);
  assert.equal(exact.pick?.id, "rw");

  const none = matchAgencyClients("Harcourts", "", barry);
  assert.equal(none.pick, null);
  assert.deepEqual(none.suggestions, []);
});

test("reading a Barry Plant work order drops the office address and does not change the webhook", async () => {
  process.env.MAKE_SHORTCUTS_SECRET = "test-make-secret";
  process.env.MAKE_JOBS_TODAY_URL = "http://127.0.0.1:9/today";
  process.env.MAKE_DEPART_URL = "http://127.0.0.1:9/depart";
  process.env.MAKE_LEAVE_URL = "http://127.0.0.1:9/leave";
  process.env.MAKE_NEWJOB_URL = "http://127.0.0.1:9/new";
  const { readScreenshots } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  let sent: FormData | null = null;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent = init?.body instanceof FormData ? init.body : null;
    return Response.json({
      ok: true,
      mode: "readScreenshots",
      pmAgency: "Barry Plant",
      address: "518 Whitehorse Road, Mitcham VIC, Aus…",
      workOrderNumber: "2611036322",
      description: "Repair the kitchen tap",
    });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emoro");
    form.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const result = await readScreenshots(form);
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.address, "");
    assert.equal(result.body.officeHint, "518 Whitehorse Road, Mitcham VIC, Aus…");
    assert.equal(result.body.pmAgency, "Barry Plant");
    assert.equal(result.body.workOrderNumber, "2611036322");
    const body = sent as unknown as FormData;
    assert.equal(body.get("mode"), "readScreenshots");
    assert.equal(body.has("address"), false);
    assert.equal(body.has("pmAgency"), false);
  } finally {
    globalThis.fetch = original;
  }
});

test("the client lookup is read-only and returns one confident match", async () => {
  process.env.NOTION_TOKEN = "ntn_test";
  process.env.JOBS_ALLOWED_EMAILS = "pat.z@orosvc.com";
  process.env.JOBS_SESSION_SECRET = "test-session-secret-value";
  const original = globalThis.fetch;
  let method = "";
  let url = "";
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    method = init?.method ?? "GET";
    url = input;
    return Response.json({
      results: [
        {
          id: "doncaster-id",
          properties: {
            Customer: { title: [{ plain_text: "Barry Plant Doncaster" }] },
            Company: { rich_text: [{ plain_text: "Barry Plant Doncaster" }] },
            Address: { rich_text: [{ plain_text: "Doncaster" }] },
          },
        },
      ],
    });
  }) as typeof fetch;
  try {
    const { POST } = await import("@/app/jobs/api/new/clients/route");
    const cookie = `${JOBS_COOKIE}=${encodeURIComponent(await signJobsSession("pat.z@orosvc.com"))}`;
    const response = await POST(
      new Request("http://localhost:3000/jobs/api/new/clients", {
        method: "POST",
        headers: { origin: "http://localhost:3000", cookie, "content-type": "application/json" },
        body: JSON.stringify({ business: "emoro", agency: "Barry Plant", hint: "Doncaster" }),
      }),
    );
    const body = (await response.json()) as { ok: boolean; pick: { id: string; name: string } | null };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.pick?.name, "Barry Plant Doncaster");
    assert.equal(method, "POST");
    assert.match(url, /data_sources\/897728e3-ee66-4be3-89ae-740d896d6b77\/query/);
  } finally {
    globalThis.fetch = original;
    delete process.env.NOTION_TOKEN;
  }
});
