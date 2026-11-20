import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mapsHref, shortAddress } from "@/lib/jobs-app/address";
import { checklistText, OPTIONAL_ITEMS, REQUIRED_ITEMS } from "@/lib/jobs-app/checklist";
import { jobsEmailAllowed } from "@/lib/jobs-app/allowlist";
import { JOBS_GOOGLE_CALLBACK_PATH, jobsGoogleRedirectUri } from "@/lib/jobs-app/google";
import { keptCount } from "@/lib/jobs-app/photos";
import { JOBS_COOKIE, JOBS_MAX_AGE, jobsCookieOptions, readJobsSession, signJobsSession } from "@/lib/jobs-app/session";
import { groupGreeting, sharedSms, smsHref, tenantSms } from "@/lib/jobs-app/sms";
import { rememberSelection, tickedFromMemory, type SmsMemory, type SmsMemoryStore } from "@/lib/jobs-app/sms-memory";
import { indexablePaths } from "@/lib/content";
import { buildVCard, buildVCardFile } from "@/lib/jobs-app/vcf";
import { voucherNote } from "@/lib/jobs-app/voucher";

const SECRET = "test-make-secret";
const ALLOWED = "pat.z@orosvc.com";

function useEnv() {
  process.env.JOBS_ALLOWED_EMAILS = ALLOWED;
  process.env.JOBS_SESSION_SECRET = "test-session-secret-value";
  process.env.JOBS_GOOGLE_CLIENT_ID = "test-client-id";
  process.env.JOBS_GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.MAKE_SHORTCUTS_SECRET = SECRET;
  process.env.MAKE_JOBS_TODAY_URL = "http://127.0.0.1:9/today";
  process.env.MAKE_DEPART_URL = "http://127.0.0.1:9/depart";
  process.env.MAKE_LEAVE_URL = "http://127.0.0.1:9/leave";
  process.env.MAKE_NEWJOB_URL = "http://127.0.0.1:9/new";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function memoryStore(): SmsMemoryStore & { value: SmsMemory } {
  const store = {
    value: {} as SmsMemory,
    read() {
      return this.value;
    },
    write(value: SmsMemory) {
      this.value = value;
    },
  };
  return store;
}

test("the checklist marks required gaps and keeps optional items out of them", () => {
  const checked = new Set<string>([REQUIRED_ITEMS[0], OPTIONAL_ITEMS[1]]);
  const result = checklistText(checked);
  assert.equal(result.missing.length, 4);
  assert.equal(result.missing.includes(OPTIONAL_ITEMS[0]), false);
  assert.equal(result.missing.includes(OPTIONAL_ITEMS[1]), false);
  assert.equal(result.text.includes(`✔ ${REQUIRED_ITEMS[0]}`), true);
  assert.equal(result.text.includes(`✘ ${OPTIONAL_ITEMS[0]}`), true);
  assert.equal(result.text.includes("; "), true);
});

test("a group message names the ticked tenants and uses the iOS group link", () => {
  const contacts = [
    { name: "Sam", phone: "+61411111111", sms: "Hi Sam, we're on the way to the job." },
    { name: "Lee", phone: "0412222222", sms: "Hi Lee, we're on the way to the job." },
  ];
  const body = sharedSms("", contacts, ["+61411111111", "+61412222222"]);
  assert.equal(body, "Hi Sam and Lee, we're on the way to the job.");
  const link = smsHref(["+61411111111", "0412222222"], body);
  assert.equal(link?.href, `sms:/open?addresses=+61411111111,+61412222222&body=${encodeURIComponent(body)}`);
  assert.equal(link?.fallback, `sms:+61411111111,+61412222222&body=${encodeURIComponent(body)}`);

  const one = smsHref(["0412111111"], "Hi Sam, we're on the way.");
  assert.equal(one?.href, `sms:+61412111111&body=${encodeURIComponent("Hi Sam, we're on the way.")}`);
  assert.equal(one?.fallback, null);
  assert.equal(groupGreeting(["Sam", "Lee", "Jo", "Amy", "Pat"], 5), "Hi all,");
  assert.equal(groupGreeting([], 3), "Hi all,");
  assert.equal(sharedSms("We're on the way.", [{ name: "Sam", phone: "+61411111111", sms: "" }], ["+61411111111"]), "Hi Sam, We're on the way.");
});

test("leave complete keeps Make's tenant SMS, including the voucher", async () => {
  useEnv();
  const { leaveJob } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  const tenantText = "Hi Sam, thanks for having us. Your $60 voucher is EMB-123456, valid to 31 Jan 2027. Review: https://g.page/r/example";
  globalThis.fetch = (async () =>
    jsonResponse({
      ok: true,
      business: "emoro",
      brand: "Emoro Building",
      outcome: "complete",
      visit: 2,
      jobTitle: "厨房漏水",
      address: "12 Smith Street, Richmond VIC 3121",
      sms: tenantText,
      contacts: [
        { name: "Sam", phone: "+61411111111", sms: tenantText },
        { name: "Lee", phone: "+61412222222", sms: tenantText.replace("Hi Sam", "Hi Lee") },
      ],
      summary: "第 2 趟已离开。整单完工。",
      pmEmailedTo: "",
      voucherCode: "EMB-123456",
      voucherExpiry: "2027-01-31",
      driveLink: "https://drive.google.com/drive/folders/example",
    })) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emoro");
    form.set("jobId", "emoro-1");
    form.set("outcome", "complete");
    form.set("notes", "");
    form.set("checklist", "✔ 门窗已锁好");
    form.set("issues", "");
    const result = await leaveJob(form);
    assert.equal(result.status, 200);
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.voucherCode, "EMB-123456");
    assert.equal(result.body.voucherExpiry, "2027-01-31");
    assert.equal(result.body.pmEmailedTo, "");
    const body = tenantSms(result.body.sms, result.body.contacts, ["+61411111111", "+61412222222"]);
    assert.equal(body, tenantText);
    assert.equal(body.includes("EMB-123456"), true);
    assert.equal(body.includes("https://g.page/r/example"), true);
  } finally {
    globalThis.fetch = original;
  }
});

test("a new work order sends an optional EMB or EMP voucher code", async () => {
  useEnv();
  const { createJob } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  let sent = "";
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const form = init?.body;
    if (form instanceof FormData) sent = String(form.get("voucher") ?? "");
    return jsonResponse({
      jobUrl: "https://www.notion.so/job-1",
      jobTitle: "Hot water",
      voucherStatus: "redeemed",
      voucherCode: "EMP-654321",
      voucherValue: 60,
      voucherBusiness: "emporo",
      voucherRedeemedDate: "",
    });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emporo");
    form.set("voucher", "  emp-654321  ");
    form.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const result = await createJob(form);
    assert.equal(sent, "EMP-654321");
    assert.equal(result.status, 200);
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.voucherStatus, "redeemed");
    assert.equal(result.body.voucherCode, "EMP-654321");
    assert.equal(result.body.voucherValue, "60");
    assert.equal(result.body.voucherBusiness, "emporo");
    assert.equal(result.body.voucherRedeemedDate, "");
    assert.equal(voucherNote(result.body.voucherStatus, result.body.voucherCode, result.body.voucherValue)?.text, "Redeemed EMP-654321, less $60");
    assert.match(voucherNote("notFound", "", "")?.text ?? "", /still created/);
    assert.equal(voucherNote("alreadyRedeemed", "EMP-654321", "", "2026-11-02")?.text, "This voucher was already redeemed on 2026-11-02. The job was still created.");
    assert.match(voucherNote("expired", "", "")?.text ?? "", /still created/);
    assert.equal(voucherNote("none", "", ""), null);
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = (async () => jsonResponse({ jobUrl: "https://www.notion.so/job-2", jobTitle: "Leak" })) as typeof fetch;
  try {
    const plain = new FormData();
    plain.set("business", "emoro");
    plain.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const result = await createJob(plain);
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.voucherStatus, "none");
    assert.equal(result.body.voucherCode, "");
  } finally {
    globalThis.fetch = original;
  }
});

test("the last recipient ticks are remembered per job", () => {
  const store = memoryStore();
  rememberSelection(store, "job-1", ["+61411111111", "+61412222222"], ["+61411111111"]);
  assert.deepEqual(tickedFromMemory(store, "job-1", ["+61411111111", "+61412222222", "+61413333333"]), [
    "+61411111111",
    "+61413333333",
  ]);
  assert.deepEqual(tickedFromMemory(store, "job-2", ["+61411111111"]), ["+61411111111"]);
});

test("a vCard uses the tenant and short address as the display name", () => {
  const input = {
    name: "Sam",
    phone: "+61411111111",
    address: "12 Smith Street, Richmond VIC 3121",
    jobTitle: "漏水",
    jobId: "abc",
  };
  assert.equal(shortAddress(input.address), "12 Smith Street Richmond");
  const card = buildVCard(input);
  assert.match(card, /FN;CHARSET=UTF-8:Sam · 12 Smith Street Richmond/);
  assert.match(card, /ADR;TYPE=HOME;CHARSET=UTF-8:;;12 Smith Street\\, Richmond VIC 3121;;;;/);
  assert.match(card, /NOTE;CHARSET=UTF-8:Job: 漏水\\nJob ID: abc/);
  assert.equal(buildVCardFile([input, { ...input, name: "Lee" }]).split("BEGIN:VCARD").length - 1, 2);
  assert.equal(mapsHref(input.address), "https://www.google.com/maps/dir/?api=1&destination=12%20Smith%20Street%2C%20Richmond%20VIC%203121&travelmode=driving");
});

test("photo batches stop before the upload budget", () => {
  assert.equal(keptCount([100, 100], 150), 1);
  assert.equal(keptCount([10, 10, 10], 40), 3);
  assert.equal(keptCount([500], 100), 0);
});

test("the jobs session lasts about 180 days and rejects a bad signature", async () => {
  process.env.JOBS_SESSION_SECRET = "test-session-secret-value";
  process.env.JOBS_ALLOWED_EMAILS = "Pat.Z@orosvc.com, other@example.com";
  assert.equal(jobsEmailAllowed("pat.z@orosvc.com"), true);
  assert.equal(jobsEmailAllowed("nope@example.com"), false);
  assert.equal(JOBS_MAX_AGE, 180 * 24 * 60 * 60);
  assert.equal(jobsCookieOptions(JOBS_MAX_AGE, true).secure, true);
  assert.equal(jobsCookieOptions(JOBS_MAX_AGE, true).httpOnly, true);
  assert.equal(jobsCookieOptions().path, "/jobs");
  assert.equal(jobsGoogleRedirectUri("https://www.orosvc.com"), `https://www.orosvc.com${JOBS_GOOGLE_CALLBACK_PATH}`);
  const token = await signJobsSession("pat.z@orosvc.com");
  assert.deepEqual(await readJobsSession(token), { ok: true, email: "pat.z@orosvc.com" });
  assert.equal(await readJobsSession(`${token.slice(0, -1)}a`), null);
  assert.equal(await readJobsSession(token, Date.now() + (JOBS_MAX_AGE + 60) * 1000), null);
  process.env.JOBS_ALLOWED_EMAILS = "other@example.com";
  assert.equal(await readJobsSession(token), null);
  process.env.JOBS_ALLOWED_EMAILS = ALLOWED;
  process.env.JOBS_SESSION_SECRET = "another-session-secret";
  assert.equal(await readJobsSession(token), null);
  process.env.JOBS_SESSION_SECRET = "test-session-secret-value";
});

test("google sign-in uses PKCE and only the allowlist", async () => {
  useEnv();
  const start = (await import("@/app/jobs/auth/google/route")).GET;
  const callback = (await import("@/app/jobs/auth/google/callback/route")).GET;
  const { finishJobsGoogleSignIn } = await import("@/lib/jobs-app/google");

  const started = await start(new Request("https://www.orosvc.com/jobs/auth/google"));
  assert.equal(started.status, 302);
  const location = new URL(started.headers.get("location") ?? "");
  assert.equal(location.origin + location.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(location.searchParams.get("redirect_uri"), "https://www.orosvc.com/jobs/auth/google/callback");
  assert.equal(location.searchParams.get("scope"), "openid email profile");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal((location.searchParams.get("code_challenge") ?? "").length > 20, true);
  const oauth = started.headers.getSetCookie().find((cookie) => cookie.startsWith("oro_jobs_oauth="));
  assert.match(oauth ?? "", /HttpOnly/i);
  const state = location.searchParams.get("state") ?? "";

  const preview = await start(
    new Request("https://preview.vercel.app/jobs/auth/google", {
      headers: { "x-forwarded-host": "oro-services-git-cursor-jobs-pwa-3080-oro-services.vercel.app", "x-forwarded-proto": "https" },
    }),
  );
  const previewUrl = new URL(preview.headers.get("location") ?? "");
  assert.equal(
    previewUrl.searchParams.get("redirect_uri"),
    "https://oro-services-git-cursor-jobs-pwa-3080-oro-services.vercel.app/jobs/auth/google/callback",
  );

  const denied = await finishJobsGoogleSignIn(
    new Request(`https://www.orosvc.com/jobs/auth/google/callback?code=valid-code&state=${state}`, {
      headers: { cookie: (oauth ?? "").split(";")[0] ?? "" },
    }),
    {
      exchangeCode: async () => "denied-token",
      verify: async () => ({ ok: false, reason: "not-allowed" }),
    },
  );
  assert.equal(denied.status, 302);
  assert.match(denied.headers.get("location") ?? "", /error=denied/);
  assert.equal(denied.headers.getSetCookie().some((cookie) => cookie.startsWith(`${JOBS_COOKIE}=`) && cookie.includes("Max-Age=15552000")), false);

  const signedIn = await finishJobsGoogleSignIn(
    new Request(`https://orosvc.com/jobs/auth/google/callback?code=valid-code&state=${state}`, {
      headers: { cookie: (oauth ?? "").split(";")[0] ?? "" },
    }),
    {
      exchangeCode: async (options) => {
        assert.equal(options.redirectUri, "https://orosvc.com/jobs/auth/google/callback");
        assert.equal(options.verifier.length > 40, true);
        return "good-token";
      },
      verify: async (_token, options) => {
        assert.equal(options.audience, "test-client-id");
        assert.equal(options.nonce.length > 20, true);
        return { ok: true, email: "pat.z@orosvc.com", name: "Pat" };
      },
    },
  );
  assert.equal(signedIn.status, 302);
  assert.equal(signedIn.headers.get("location"), "https://orosvc.com/jobs");
  const session = signedIn.headers.getSetCookie().find((cookie) => cookie.startsWith(`${JOBS_COOKIE}=`));
  assert.match(session ?? "", /HttpOnly/i);
  assert.match(session ?? "", /Path=\/jobs/);
  assert.match(session ?? "", /Max-Age=15552000/);
  assert.equal(typeof callback, "function");
});

test("api routes proxy the webhooks and keep the secret on the server", async () => {
  useEnv();
  const today = (await import("@/app/jobs/api/today/route")).POST;
  const depart = (await import("@/app/jobs/api/depart/route")).POST;
  const leave = (await import("@/app/jobs/api/leave/route")).POST;
  const create = (await import("@/app/jobs/api/new/route")).POST;
  const original = globalThis.fetch;

  const loggedOut = await today(new Request("http://localhost:3000/jobs/api/today", { method: "POST", headers: { origin: "http://localhost:3000" } }));
  assert.equal(loggedOut.status, 401);

  const cookie = `${JOBS_COOKIE}=${encodeURIComponent(await signJobsSession("pat.z@orosvc.com"))}`;

  function authed(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("cookie", cookie);
    headers.set("origin", "http://localhost:3000");
    return new Request(url, { ...init, headers });
  }

  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const form = init?.body instanceof FormData ? init.body : null;
    calls.push({ url, body: form ?? JSON.parse(String(init?.body)) });
    if (url.endsWith("/today")) {
      const business = (JSON.parse(String(init?.body)) as { business: string }).business;
      return jsonResponse({
        ok: true,
        date: "2026-11-20",
        jobs: [{ business, jobId: `${business}-1`, title: business === "emoro" ? "漏水" : "热水", address: "1 High St", status: "Scheduled", scheduled: "09:00" }],
        secret: SECRET,
      });
    }
    if (url.endsWith("/depart")) {
      return jsonResponse({
        ok: true,
        business: "emoro",
        brand: "Emoro Building",
        visit: 2,
        jobTitle: "漏水",
        address: "12 Smith Street, Richmond VIC 3121",
        tenant: "Sam",
        departedAt: "2026-11-20T03:00:00.000Z",
        jobStatus: "In progress",
        sms: `Hi Sam, on the way. ${SECRET}`,
        contacts: [
          { name: "Sam", phone: "+61411111111", sms: `Hi Sam, on the way. ${SECRET}` },
          { name: "Lee", phone: "+61412222222", sms: "Hi Lee, on the way." },
        ],
      });
    }
    if (url.endsWith("/leave")) {
      return jsonResponse({ ok: false, error: "no open visit for this job - tap Depart first" }, 409);
    }
    return jsonResponse({ error: "noAddress" }, 200);
  }) as typeof fetch;

  try {
    const listed = await today(authed("http://localhost:3000/jobs/api/today", { method: "POST" }));
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.jobs.length, 2);
    assert.equal(listedBody.jobs[0].title, "漏水");
    assert.equal(listedBody.jobs[1].business, "emporo");
    assert.equal(JSON.stringify(listedBody).includes(SECRET), false);
    assert.deepEqual(
      calls.filter((call) => String(call.url).endsWith("/today")).map((call) => (call.body as { business: string }).business).sort(),
      ["emoro", "emporo"],
    );
    assert.equal((calls[0]?.body as { secret: string }).secret, SECRET);

    const left = await depart(authed("http://localhost:3000/jobs/api/depart", { method: "POST", body: JSON.stringify({ business: "emoro", jobId: "emoro-1" }) }));
    const leftBody = await left.json();
    assert.equal(left.status, 200);
    assert.equal(leftBody.contacts.length, 2);
    assert.equal(leftBody.sms.includes(SECRET), false);
    assert.equal(JSON.stringify(leftBody).includes(SECRET), false);

    const form = new FormData();
    form.set("business", "emoro");
    form.set("jobId", "emoro-1");
    form.set("outcome", "complete");
    form.set("notes", "done");
    form.set("checklist", "✔ 门窗已锁好");
    form.set("issues", "damp");
    form.append("photos", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "a.jpg", { type: "image/jpeg" }));
    const deniedLeave = await leave(authed("http://localhost:3000/jobs/api/leave", { method: "POST", body: form }));
    const deniedBody = await deniedLeave.json();
    assert.equal(deniedLeave.status, 409);
    assert.equal(deniedBody.error, "no_open_visit");
    assert.match(deniedBody.message, /Depart/);
    const leaveCall = calls.find((call) => String(call.url).endsWith("/leave"));
    assert.ok(leaveCall?.body instanceof FormData);
    assert.equal(leaveCall.body.get("secret"), SECRET);
    assert.equal(leaveCall.body.get("outcome"), "complete");
    assert.equal(leaveCall.body.getAll("photos").length, 1);

    const images = new FormData();
    images.set("business", "emporo");
    images.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const created = await create(authed("http://localhost:3000/jobs/api/new", { method: "POST", body: images }));
    const createdBody = await created.json();
    assert.equal(created.status, 422);
    assert.equal(createdBody.error, "no_address");
    assert.match(createdBody.message, /address/i);

    globalThis.fetch = (async () => jsonResponse({ error: "needBusiness" }, 200)) as typeof fetch;
    const needBusiness = await create(authed("http://localhost:3000/jobs/api/new", { method: "POST", body: images }));
    assert.equal((await needBusiness.json()).error, "need_business");

    globalThis.fetch = (async () => jsonResponse({ error: "unauthorized" }, 401)) as typeof fetch;
    const unauthorized = await create(authed("http://localhost:3000/jobs/api/new", { method: "POST", body: images }));
    const unauthorizedBody = await unauthorized.json();
    assert.equal(unauthorized.status, 502);
    assert.equal(unauthorizedBody.error, "webhook_unauthorized");
    assert.match(unauthorizedBody.message, /key/i);

    globalThis.fetch = (async () =>
      jsonResponse({
        jobUrl: "https://www.notion.so/job-1",
        jobTitle: "New leak",
        brand: "Emporo Plumbing",
        address: "9 High Street",
        tenant1: "Sam",
        phone1: "0411111111",
        pmName: "Pat PM",
        pmEmail: "pm@agency.com",
        workOrderNumber: "WO-9",
        description: "Hot water",
        propertyCreated: false,
        customerCreated: true,
        contact1Created: true,
      })) as typeof fetch;
    const imagesAgain = new FormData();
    imagesAgain.set("business", "emporo");
    imagesAgain.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const ready = await create(authed("http://localhost:3000/jobs/api/new", { method: "POST", body: imagesAgain }));
    const readyBody = await ready.json();
    assert.equal(ready.status, 200);
    assert.equal(readyBody.jobUrl, "https://www.notion.so/job-1");
    assert.equal(readyBody.workOrderNumber, "WO-9");
    assert.equal(readyBody.propertyCreated, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("the public site does not advertise /jobs and the source has no webhook URL", () => {
  assert.equal(indexablePaths().some((entry) => entry.path.startsWith("/jobs")), false);
  const robotsSource = readFileSync(new URL("../src/app/robots.ts", import.meta.url), "utf8");
  assert.equal(robotsSource.includes('"/jobs"'), true);
  const files = walk(fileURLToPath(new URL("../src", import.meta.url)));
  const forbidden = ["hook.eu1.make.com", "1eze2f6sdavamqkp2xug103frhp1gfzd", "psiz1g7guw4fqajmgx8i6jyym74icvc0", "qyxth4trckyy659cglp3j20tc0jrrm69", "f723ocanjpgjraicvtpfwfk8y9bgbtiy"];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) assert.equal(text.includes(needle), false, `${file} contains ${needle}`);
    if (file.includes(`${join("components", "jobs")}`) || (file.includes(`${join("app", "jobs")}`) && !file.includes(`${join("api")}`))) {
      assert.equal(text.includes("MAKE_"), false, file);
      assert.equal(text.includes("JOBS_APP_PASSWORD"), false, file);
      assert.equal(text.includes("JOBS_SESSION_SECRET"), false, file);
    }
  }
  const jobsUi = walk(fileURLToPath(new URL("../src", import.meta.url))).filter((file) =>
    /\/jobs\/|\/jobs-app\//.test(file),
  );
  for (const file of jobsUi) {
    const source = readFileSync(file, "utf8").replace(/const chinese = \/[\s\S]*?\);/, "");
    assert.equal(/[\u4e00-\u9fff]/.test(source), false, file);
  }
  const header = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8");
  assert.equal(header.includes("/jobs"), false);
  assert.equal(footer.includes("/jobs"), false);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}
