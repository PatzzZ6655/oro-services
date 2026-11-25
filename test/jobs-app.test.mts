import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mapsHref, shortAddress } from "@/lib/jobs-app/address";
import { introBody, introSubject, introTenantLine } from "@/lib/jobs-app/intro-email";
import { checklistText, OPTIONAL_ITEMS, REQUIRED_ITEMS } from "@/lib/jobs-app/checklist";
import { jobsEmailAllowed } from "@/lib/jobs-app/allowlist";
import { JOBS_GOOGLE_CALLBACK_PATH, jobsGoogleRedirectUri } from "@/lib/jobs-app/google";
import { leaveDraftDirty, parseLeaveDraft } from "@/lib/jobs-app/leave-draft";
import { newJobDraftDirty, parseNewJobDraft, parseNewJobIntroHold } from "@/lib/jobs-app/new-job-draft";
import {
  newJobTextCoversScreenshots,
  preferTyped,
  readNewJobText,
  screenshotReadFallback,
  tenantPayload,
  tenantsFromRead,
  tenantsFromTyped,
} from "@/lib/jobs-app/new-job-text";
import { keptCount } from "@/lib/jobs-app/photos";
import { JOBS_COOKIE, JOBS_MAX_AGE, jobsCookieOptions, readJobsSession, signJobsSession } from "@/lib/jobs-app/session";
import { existingInvoiceMessage, invoiceNumberToShow } from "@/lib/jobs-app/invoice";
import { arrivalSms, formatNextVisit, nextVisitBody, nextVisitSms } from "@/lib/jobs-app/next-visit";
import { completeJobSms, groupGreeting, messageBody, sharedSms, smsHref, tenantSms } from "@/lib/jobs-app/sms";
import { invoiceContext, invoiceCreate, invoiceCreateBody, invoiceDraft } from "@/lib/jobs-app/webhooks";
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
  const sent: { body: FormData | null } = { body: null };
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent.body = init?.body instanceof FormData ? init.body : null;
    return jsonResponse({
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
    });
  }) as typeof fetch;
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
    assert.equal(sent.body?.get("includeVoucher"), "0");
    form.set("includeVoucher", "1");
    const withVoucher = await leaveJob(form);
    assert.equal(withVoucher.status, 200);
    assert.equal(sent.body?.get("includeVoucher"), "1");
    form.set("outcome", "return");
    form.set("includeVoucher", "1");
    const comingBack = await leaveJob(form);
    assert.equal(comingBack.status, 200);
    assert.equal(sent.body?.get("includeVoucher"), "0");
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

test("a completed job uses the thank-you voucher sentence for both brands", () => {
  const prefix = "Hi Sam, the works at 12 Smith Street are now complete. Thank you for your cooperation and understanding, and all the best! ";
  const old = (code: string, brand: string) =>
    `${prefix}As a thank-you, here is a $60 voucher: ${code}, valid until 22 Feb 2027. Mention it when you book with us again and we'll take $60 off. - ${brand}`;
  const next = (code: string, brand: string) =>
    `${prefix}As a thank-you, here's a $60 voucher just for you: ${code} (min. spend $150, valid until 22 Feb 2027, T&Cs apply). Mention it when you book your own job with us and we'll take $60 off. - ${brand}`;
  const emoro = next("EMB-8A133B", "Emoro Building");
  const emporo = next("EMP-8A133B", "Emporo Plumbing");
  assert.equal(completeJobSms(old("EMB-8A133B", "Emoro Building")), emoro);
  assert.equal(completeJobSms(old("EMP-8A133B", "Emporo Plumbing")), emporo);
  const withReview = `${old("EMB-8A133B", "Emoro Building").replace(" - Emoro Building", "")} If you were happy with our work, we'd really appreciate a Google review: https://g.page/r/example - Emoro Building`;
  assert.equal(completeJobSms(withReview).includes("https://g.page/r/example - Emoro Building"), true);
  assert.equal(completeJobSms(withReview).includes("here's a $60 voucher just for you: EMB-8A133B"), true);
  const plain = "Hi Sam, the works at 12 Smith Street are now complete. Thank you. - Emoro Building";
  assert.equal(completeJobSms(plain), plain);
  const returned = "Hi Sam, Emoro Building here. Today's work at 12 Smith Street is done. We will be in touch soon to arrange the next visit. Thank you for your patience. - Emoro Building";
  assert.equal(tenantSms(returned, [{ name: "Sam", phone: "+61411111111", sms: returned }], ["+61411111111"]), returned);
  assert.equal(tenantSms(old("EMB-8A133B", "Emoro Building"), [{ name: "Sam", phone: "+61411111111", sms: "" }], ["+61411111111"]), emoro);
});

test("a tax invoice uses the new-job webhook and never sends the secret to the page", async () => {
  useEnv();
  const original = globalThis.fetch;
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sent.push(body);
    if (body.mode === "invoiceContext") {
      return jsonResponse({
        ok: true,
        brand: "Emoro Building",
        jobId: "abc",
        customer: { id: "c1", name: "Sam Lee" },
        property: { id: "p1", name: "12 Smith Street" },
        suggestedNumber: "INV-1042",
        numberNote: "Next free number",
        existingInvoice: { number: "INV-1001", status: "Draft", url: "https://www.notion.so/old", docIds: ["doc-1"] },
        reuseExistingPage: true,
        secret: SECRET,
      });
    }
    if (body.mode === "invoiceCreate" && body.invoiceNumber === "INV-1001") {
      return jsonResponse({
        ok: true,
        status: "exists",
        invoiceNumber: "INV-1001",
        notionUrl: "https://www.notion.so/old",
        docUrl: "https://docs.google.com/document/d/old",
      });
    }
    if (body.mode === "invoiceCreate" && sent.filter((item) => item.mode === "invoiceCreate" && item.invoiceNumber !== "INV-1001").length === 1) {
      return jsonResponse({ ok: false, status: "pending" }, 202);
    }
    if (body.mode === "invoiceCreate") {
      return jsonResponse({
        ok: true,
        status: "created",
        invoicePageId: "page-1",
        notionUrl: "https://www.notion.so/page-1",
        invoiceNumber: "INV-1042",
        docId: "doc-9",
        docUrl: "https://docs.google.com/document/d/doc-9",
        templateCheck: "ok",
        isTest: true,
      });
    }
    return jsonResponse({
      ok: true,
      draft: {
        primaryObjective: "Fix the tap",
        tasks: [{ label: "Tap", text: "Replace the washer" }],
        suggestedClauses: ["GST inclusive"],
        missing: [{ item: "Test result", why: "Not dictated" }, { item: "Parts" }],
        questions: [{ item: "How many visits?", why: "Needed for the scope" }, "Any warranty?"],
        amountLayoutSuggestion: "combined",
      },
    });
  }) as typeof fetch;
  try {
    const payload = invoiceCreateBody({
      business: "emoro",
      type: "general",
      jobId: "abc-def",
      invoiceNumber: "INV-1042",
      primaryObjective: "Fix the tap",
      tasks: [{ label: "Tap", text: "Replace the washer" }],
      recommendation: "",
      notesMode: "remove",
      notesText: "",
      qaBox: "keep",
      amountLayout: "combined",
    });
    assert.equal(payload?.mode, "invoiceCreate");
    assert.equal(payload?.jobId, "abcdef");
    assert.equal("secret" in (payload ?? {}), false);
    assert.equal("email" in (payload ?? {}), false);
    assert.equal("sms" in (payload ?? {}), false);

    const context = await invoiceContext({ business: "emoro", type: "general", jobId: "abc" });
    if (!context.body.ok) throw new Error(context.body.message);
    assert.equal(context.body.suggestedNumber, "INV-1042");
    assert.equal(context.body.customer.name, "Sam Lee");
    assert.equal(context.body.existingInvoice.number, "INV-1001");
    assert.equal(context.body.reuseExistingPage, true);
    assert.equal(JSON.stringify(context.body).includes(SECRET), false);
    assert.equal(sent[0]?.secret, SECRET);
    assert.equal(sent[0]?.mode, "invoiceContext");

    const pending = await invoiceCreate({
      business: "emoro",
      type: "general",
      jobId: "abc",
      invoiceNumber: "INV-1042",
      primaryObjective: "Fix the tap",
      tasks: [],
      recommendation: "",
      notesMode: "remove",
      notesText: "",
      qaBox: "keep",
      amountLayout: "combined",
    });
    assert.equal(pending.status, 202);
    if (!pending.body.ok) throw new Error(pending.body.message);
    assert.equal(pending.body.status, "pending");

    const created = await invoiceCreate({
      business: "emoro",
      type: "general",
      jobId: "abc",
      invoiceNumber: "INV-1042",
      primaryObjective: "Fix the tap",
      tasks: [],
      recommendation: "",
      notesMode: "remove",
      notesText: "",
      qaBox: "keep",
      amountLayout: "combined",
    });
    assert.equal(created.status, 200);
    if (!created.body.ok) throw new Error(created.body.message);
    assert.equal(created.body.docUrl, "https://docs.google.com/document/d/doc-9");
    assert.equal(created.body.isTest, true);
    assert.equal(created.body.message, "Word draft is ready.");

    const exists = await invoiceCreate({
      business: "emoro",
      type: "general",
      jobId: "abc",
      invoiceNumber: "INV-1001",
      primaryObjective: "Fix the tap",
      tasks: [],
      recommendation: "",
      notesMode: "remove",
      notesText: "",
      qaBox: "keep",
      amountLayout: "combined",
    });
    if (!exists.body.ok) throw new Error(exists.body.message);
    assert.equal(exists.body.status, "exists");
    assert.equal(exists.body.docUrl, "https://docs.google.com/document/d/old");
    assert.equal(
      exists.body.message,
      "This job already has a draft invoice (INV-1001). Your new wording was not written — open the existing doc to edit it.",
    );
    const existsSent = sent.find((item) => item.mode === "invoiceCreate" && item.invoiceNumber === "INV-1001");
    assert.equal(existsSent?.overwrite, undefined);
    assert.equal("force" in (existsSent ?? {}), false);

    const callsBeforeFinish = sent.length;
    const { POST } = await import("@/app/jobs/api/invoice/route");
    const cookie = `${JOBS_COOKIE}=${encodeURIComponent(await signJobsSession("pat.z@orosvc.com"))}`;
    const finish = await POST(
      new Request("http://localhost:3000/jobs/api/invoice", {
        method: "POST",
        headers: { origin: "http://localhost:3000", cookie, "content-type": "application/json" },
        body: JSON.stringify({ mode: "invoiceFinish", business: "emoro", type: "general", jobId: "abc", invoicePageId: "page-1", confirm: "yes" }),
      }),
    );
    const finishBody = await finish.json();
    assert.equal(finish.status, 403);
    assert.equal(finishBody.message, "finish disabled");
    assert.equal(sent.length, callsBeforeFinish);

    const drafted = await invoiceDraft({ business: "emoro", type: "general", jobId: "abc", dictation: "The kitchen tap was leaking." });
    if (!drafted.body.ok) throw new Error(drafted.body.message);
    assert.equal(drafted.body.draft.primaryObjective, "Fix the tap");
    assert.equal(drafted.body.draft.tasks[0]?.label, "Tap");
    assert.deepEqual(drafted.body.draft.missing, ["Test result — Not dictated", "Parts"]);
    assert.deepEqual(drafted.body.draft.questions, ["How many visits? — Needed for the scope", "Any warranty?"]);
    assert.equal(invoiceNumberToShow("INV-1001", "", "EMB_INV_0162"), "INV-1001");
    assert.equal(invoiceNumberToShow("", "TYPED", "EMB_INV_0162"), "TYPED");
    assert.equal(invoiceNumberToShow("", "", "EMB_INV_0162"), "EMB_INV_0162");
    assert.equal(
      existingInvoiceMessage("EMB_INV_0162"),
      "This job already has a draft invoice (EMB_INV_0162). Your new wording was not written — open the existing doc to edit it.",
    );

    const page = readFileSync(new URL("../src/components/jobs/invoice-wizard.tsx", import.meta.url), "utf8");
    const leave = readFileSync(new URL("../src/components/jobs/leave-screen.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../src/app/jobs/api/invoice/route.ts", import.meta.url), "utf8");
    assert.match(page, /Create Tax Invoice|Draft with AI/);
    assert.equal(page.includes("patch({ clientName"), false);
    assert.equal(page.includes("patch({ address"), false);
    assert.match(page, /invoiceNumberToShow\(context\.existingInvoice\?\.number/);
    assert.match(page, /Invoice number/);
    assert.match(page, /Generate Word \(Draft\)/);
    assert.equal(page.includes("Finish: PDF to Recently"), false);
    assert.equal(page.includes("invoiceFinish"), false);
    assert.match(page, /status === "pending"/);
    assert.match(route, /finish disabled/);
    assert.match(leave, /Create Tax Invoice/);
    assert.match(leave, /Skip/);
    assert.equal(page.includes("MAKE_SHORTCUTS_SECRET"), false);
    assert.equal(route.includes("secret"), false);
    assert.match(route, /invoiceCreate/);
  } finally {
    globalThis.fetch = original;
  }
});

test("a return visit sms names the Melbourne day and a 12-hour time", () => {
  const both = nextVisitSms({
    name: "Sam",
    brand: "Emoro Building",
    address: "12 Smith Street",
    date: "2025-11-25",
    time: "09:00",
  });
  assert.equal(
    both,
    "Hi Sam, Emoro Building here. Today's work at 12 Smith Street is done. We'll be back on Tue 25/11 at 9:00am to continue. See you then, thanks! - Emoro Building",
  );
  assert.equal(
    nextVisitSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", date: "2025-11-25", time: "" }),
    "Hi Sam, Emoro Building here. Today's work at 12 Smith Street is done. We'll be back on Tue 25/11 to continue. See you then, thanks! - Emoro Building",
  );
  assert.equal(formatNextVisit("2025-11-25", "13:30"), "Tue 25/11 at 1:30pm");
  assert.equal(formatNextVisit("2025-11-25", "00:05"), "Tue 25/11 at 12:05am");
  assert.equal(formatNextVisit("2025-11-25", "12:00"), "Tue 25/11 at 12:00pm");
  assert.equal(nextVisitSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", date: "", time: "09:00" }), null);
  assert.equal(formatNextVisit("2025-02-31", "09:00"), null);
  const body = nextVisitBody({ brand: "Emoro Building", address: "12 Smith Street", date: "2025-11-25", time: "09:00" });
  if (!body) throw new Error("next visit body missing");
  assert.equal(messageBody(body, ["Sam", "Lee"], 2), `Hi Sam and Lee, ${body}`);
  assert.equal(sharedSms("Hi Sam, We're on the way.", [{ name: "Sam", phone: "+61411111111", sms: "" }], ["+61411111111"]), "Hi Sam, We're on the way.");
  const picker = readFileSync(new URL("../src/components/jobs/sms-picker.tsx", import.meta.url), "utf8");
  const leave = readFileSync(new URL("../src/components/jobs/leave-screen.tsx", import.meta.url), "utf8");
  const depart = readFileSync(new URL("../src/components/jobs/depart-screen.tsx", import.meta.url), "utf8");
  assert.match(picker, /Next visit date/);
  assert.match(picker, /Next visit time/);
  assert.match(picker, /type="date"/);
  assert.match(picker, /type="time"/);
  assert.match(leave, /outcome === "return"/);
  assert.equal(leave.includes('form.set("date"'), false);
  assert.equal(depart.includes("Next visit date"), false);
});

test("a depart sms names the arrival time and leaves the vague text alone", () => {
  const first = "Hi Sam, Emoro Building here. We're on our way to 12 Smith Street and should be there around 9:30am. Thanks! - Emoro Building";
  const again = "Hi Sam, Emoro Building here. We're on our way back to 12 Smith Street and should be there around 1:00pm to continue the job. See you soon. Thanks! - Emoro Building";
  assert.equal(arrivalSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", visit: "1", time: "09:30" }), first);
  assert.equal(arrivalSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", visit: "", time: "09:30" }), first);
  assert.equal(arrivalSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", visit: "2", time: "13:00" }), again);
  assert.equal(arrivalSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", visit: "3", time: "13:00" }), again);
  assert.equal(arrivalSms({ name: "Sam", brand: "Emoro Building", address: "12 Smith Street", visit: "2", time: "" }), null);
  const vagueFirst = "Hi Sam, this is Emoro Building. Your repair job at 12 Smith Street is up next on our schedule today, and we'll visit you shortly. Thank you. - Emoro Building";
  const vagueAgain = "Hi Sam, this is Emoro Building. Your job at 12 Smith Street is up next on our schedule today, and we'll be back shortly to continue the work. Thank you. - Emoro Building";
  const contact = [{ name: "Sam", phone: "+61411111111", sms: "" }];
  assert.equal(sharedSms(vagueFirst, contact, ["+61411111111"]), vagueFirst);
  assert.equal(sharedSms(vagueAgain, contact, ["+61411111111"]), vagueAgain);
  const picker = readFileSync(new URL("../src/components/jobs/sms-picker.tsx", import.meta.url), "utf8");
  const depart = readFileSync(new URL("../src/components/jobs/depart-screen.tsx", import.meta.url), "utf8");
  assert.match(picker, /Arrival time/);
  assert.match(picker, /type="time"/);
  assert.match(picker, /review it before sending/);
  assert.match(depart, /arrival=\{\{/);
  assert.match(depart, /postJobs<DepartResult>\("\/jobs\/api\/depart", \{ business: job\.business, jobId: job\.jobId \}\)/);
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

test("typed new job details are extra fields and can stand in for screenshots", async () => {
  useEnv();
  const { createJob } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  let sent: FormData | null = null;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent = init?.body instanceof FormData ? init.body : null;
    return jsonResponse({ jobUrl: "https://www.notion.so/job-typed", jobTitle: "Leak" });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emoro");
    form.set("tenantName", "  Sam Lee  ");
    form.set("phone", "0412 345 678");
    form.set("address", "12 Smith St");
    form.set("description", "Leaking tap");
    form.set("workOrderNumber", "WO-9");
    form.set("notes", "Gate code 1234\nDog in yard");
    form.set("voucher", " emb-123456 ");
    const result = await createJob(form);
    assert.equal(result.status, 200);
    assert.ok(sent);
    const body = sent as unknown as FormData;
    assert.equal(body.get("secret"), SECRET);
    assert.equal(body.get("business"), "emoro");
    assert.equal(body.get("voucher"), "EMB-123456");
    assert.equal(body.get("tenantName"), "Sam Lee");
    assert.equal(body.get("phone"), "0412 345 678");
    assert.equal(body.get("address"), "12 Smith St");
    assert.equal(body.get("description"), "Leaking tap");
    assert.equal(body.get("workOrderNumber"), "WO-9");
    assert.equal(body.get("notes"), "Gate code 1234\nDog in yard");
    assert.equal(body.getAll("images").length, 0);
    assert.equal(body.has("mode"), false);
    assert.equal(body.has("jobId"), false);

    const withShot = new FormData();
    withShot.set("business", "emporo");
    withShot.set("address", "  4 Lane  ");
    withShot.set("description", "  Hot water  ");
    withShot.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const both = await createJob(withShot);
    assert.equal(both.status, 200);
    const bothBody = sent as unknown as FormData;
    assert.equal(bothBody.get("address"), "4 Lane");
    assert.equal(bothBody.get("description"), "Hot water");
    assert.equal(bothBody.has("tenantName"), false);
    assert.equal(bothBody.getAll("images").length, 1);
    assert.equal(bothBody.get("business"), "emporo");
  } finally {
    globalThis.fetch = original;
  }

  const onlyDescription = new FormData();
  onlyDescription.set("business", "emoro");
  onlyDescription.set("description", "Leaking tap");
  const missing = await createJob(onlyDescription);
  assert.equal(missing.status, 400);
  if (missing.body.ok) throw new Error("expected a rejection");
  assert.match(missing.body.message, /name or address/);

  const typed = readNewJobText(onlyDescription);
  assert.equal(newJobTextCoversScreenshots(typed), false);
  assert.equal(newJobTextCoversScreenshots({ ...typed, tenantName: "Sam" }), true);
  assert.equal(newJobTextCoversScreenshots({ ...typed, address: "12 Smith St", tenantName: "" }), true);
});

test("a new job sends every tenant and the first two in the old fields", async () => {
  useEnv();
  const { createJob } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  let sent: FormData | null = null;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent = init?.body instanceof FormData ? init.body : null;
    return jsonResponse({ jobUrl: "https://www.notion.so/job-tenants", jobTitle: "Leak" });
  }) as typeof fetch;
  try {
    const rows = [
      { name: "Sam Lee", phone: "0412000001", email: "sam@example.com" },
      { name: "Jo Kim", phone: "0412000002", email: "jo@example.com" },
      { name: "Pat Wu", phone: "0412000003", email: "" },
      { name: "", phone: "", email: "" },
    ];
    const form = new FormData();
    form.set("business", "emoro");
    form.set("address", "12 Smith St");
    form.set("description", "Leaking tap");
    form.set("tenants", JSON.stringify(rows));
    const result = await createJob(form);
    assert.equal(result.status, 200);
    const body = sent as unknown as FormData;
    assert.deepEqual(JSON.parse(String(body.get("tenants"))), rows.slice(0, 3));
    assert.equal(body.get("tenantName"), "Sam Lee");
    assert.equal(body.get("phone"), "0412000001");
    assert.equal(body.get("email"), "sam@example.com");
    assert.equal(body.get("tenant2Name"), "Jo Kim");
    assert.equal(body.get("phone2"), "0412000002");
    assert.equal(body.get("email2"), "jo@example.com");
    assert.equal(body.has("mode"), false);
    assert.equal(tenantPayload(rows).tenants, body.get("tenants"));
  } finally {
    globalThis.fetch = original;
  }

  const fromPairs = tenantsFromRead(
    {
      tenantName: "From photo",
      phone: "0400000000",
      email: "photo@example.com",
      tenant2Name: "Second",
      phone2: "0400000001",
      email2: "second@example.com",
    },
    { name: "Typed", phone: "" },
  );
  assert.equal(fromPairs[0]?.name, "Typed");
  assert.equal(fromPairs[0]?.phone, "0400000000");
  assert.equal(fromPairs[0]?.email, "photo@example.com");
  assert.equal(fromPairs[1]?.name, "Second");

  const fromList = tenantsFromRead(
    {
      tenants: [
        { name: "One", phone: "1", email: "one@example.com" },
        { name: "Two", phone: "2", email: "two@example.com" },
        { name: "Three", phone: "3", email: "three@example.com" },
      ],
      tenantName: "Ignored",
    },
    { name: "", phone: "" },
  );
  assert.equal(fromList.length, 3);
  assert.equal(fromList[2]?.email, "three@example.com");
  assert.deepEqual(tenantsFromTyped("", ""), [{ name: "", phone: "", email: "" }]);
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
    assert.equal(leaveCall.body.get("includeVoucher"), "0");
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

test("the intro email uses only the confirmed job text", async () => {
  const preview = {
    business: "emoro" as const,
    brand: "Emoro Building",
    address: "12 Test Street",
    pmAgency: "Test Agency",
    desc: "Leaking kitchen tap",
    tenants: [
      { name: "Sam Lee", email: "sam@example.com" },
      { name: "Jo Kim", email: "" },
    ],
  };
  assert.equal(introSubject(preview.address, preview.brand), "Repair Request At 12 Test Street – Emoro Building");
  const body = introBody(preview, "Sam Lee");
  assert.equal(body.includes("Leaking kitchen tap"), true);
  assert.equal(body.includes(" at Test Agency"), true);
  assert.equal(body.includes("voucher"), false);
  assert.equal(introTenantLine(preview.tenants[1]!), "Jo Kim — no email - not sent");
  assert.equal(introBody({ ...preview, pmAgency: "  " }, "Sam Lee").includes("property manager at "), false);
  assert.equal(body.includes("property manager at Test Agency"), true);

  useEnv();
  const { sendIntroEmail, createJob } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  let sent = "";
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent = String(init?.body ?? "");
    return jsonResponse({ ok: true, mode: "sendIntroEmail", status: "queued", message: "queued", sendAt: "next 08:00 Australia/Melbourne" });
  }) as typeof fetch;
  try {
    const result = await sendIntroEmail({
      jobId: "abc",
      business: "emporo",
      desc: "Leaking kitchen tap",
      address: "12 Test Street",
      pmAgency: "",
      tenants: [{ name: "Sam Lee", email: "sam@example.com" }],
      action: "send",
    });
    assert.equal(result.status, 200);
    const payload = JSON.parse(sent) as Record<string, unknown>;
    assert.equal(payload.mode, "sendIntroEmail");
    assert.equal(payload.action, "send");
    assert.equal(payload.desc, "Leaking kitchen tap");
    assert.equal(payload.pmAgency, "");
    assert.equal("forceQueue" in payload, false);
    assert.equal(typeof payload.secret, "string");
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.status, "queued");
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = (async () =>
    jsonResponse({
      ok: true,
      jobUrl: "https://www.notion.so/job-1",
      jobId: "abc123",
      desc: "Confirmed tap",
      description: "Notion job description",
      address: "12 Test Street",
    })) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emoro");
    form.set("address", "12 Test Street");
    form.set("description", "Typed description");
    form.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const created = await createJob(form);
    if (!created.body.ok) throw new Error(created.body.message);
    assert.equal(created.body.desc, "Confirmed tap");
    assert.equal(created.body.description, "Notion job description");
  } finally {
    globalThis.fetch = original;
  }
});

test("the new job screen checks the details before it creates the job", () => {
  const page = readFileSync(new URL("../src/components/jobs/new-screen.tsx", import.meta.url), "utf8");
  assert.match(page, /PhotoBurst/);
  assert.match(page, /doneLabel="Done"/);
  assert.match(page, /Continue/);
  assert.match(page, /Add tenant/);
  assert.match(page, /Tenants/);
  assert.match(page, /Choose Emoro Building or Emporo Plumbing first/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /title="Check job"/);
  assert.match(page, /Create job/);
  assert.match(page, /\/jobs\/api\/new\/read/);
  assert.match(page, /screenshotReadFallback/);
  assert.equal(page.includes("introTestNote"), false);
  assert.equal(page.includes("While testing, To is rewritten"), false);
  const intro = readFileSync(new URL("../src/lib/jobs-app/intro-email.ts", import.meta.url), "utf8");
  assert.equal(intro.includes("introTestRecipient"), false);
  assert.equal(intro.includes("introTestNote"), false);
  assert.equal(intro.includes("pat.z+tenant-intro@orosvc.com"), false);
  assert.equal(screenshotReadFallback, "Couldn't read the screenshots — type the details in");
  const lock = readFileSync(new URL("../src/components/jobs/keep-page.tsx", import.meta.url), "utf8");
  const depart = readFileSync(new URL("../src/components/jobs/depart-screen.tsx", import.meta.url), "utf8");
  const leave = readFileSync(new URL("../src/components/jobs/leave-screen.tsx", import.meta.url), "utf8");
  assert.match(lock, /overscrollBehaviorY = "none"/);
  assert.match(lock, /data-jobs-scroll/);
  assert.match(page, /KeepPage/);
  assert.match(page, /beforeunload/);
  assert.match(depart, /KeepPage/);
  assert.equal(depart.includes('postJobs<DepartResult>("/jobs/api/depart"'), true);
  assert.match(leave, /KeepPage/);
  assert.match(leave, /beforeunload/);
  assert.match(leave, /clearStoredLeaveDraft/);
  assert.equal(leave.includes('form.set("business"'), true);
  assert.equal(leave.includes('form.set("jobId"'), true);
  assert.equal(leave.includes('form.set("outcome"'), true);
  assert.equal(leave.includes('form.set("notes"'), true);
  assert.equal(leave.includes('form.set("issues"'), true);
  assert.equal(leave.includes('form.set("checklist"'), true);
  assert.equal(leave.includes('form.append("photos"'), true);
  assert.match(page, /writeStoredNewJobDraft/);
  assert.match(page, /clearStoredNewJobIntro/);
  assert.match(page, /PM agency/);
  assert.equal(page.includes('form.set("mode"'), false);
  assert.equal(page.includes('form.set("pmAgency"'), false);
  assert.equal(page.includes("readScreenshots"), false);
  assert.equal(page.includes("MAKE_SHORTCUTS_SECRET"), false);
  assert.equal(page.includes("forceQueue"), false);
  assert.equal(preferTyped("Sam", "Lee"), "Sam");
  assert.equal(preferTyped("  ", "12 Smith St"), "12 Smith St");
  assert.equal(preferTyped("", "EMB-1"), "EMB-1");
});

test("a new job draft restores typed fields and the screenshot read, then drops after the intro", () => {
  const draft = parseNewJobDraft(
    JSON.stringify({
      step: "check",
      business: "emoro",
      tenantName: "Sam",
      phone: "0400000000",
      tenants: [
        { name: "Sam Lee", phone: "0400000000", email: "sam@example.com" },
        { name: "Alex", phone: "", email: "alex@example.com" },
      ],
      address: "12 Smith St",
      pmAgency: "Ray White",
      description: "Leaking tap",
      notes: "Dog in the yard",
      workOrderNumber: "WO-9",
      voucher: "emb-1",
      screenshotCount: 2,
      read: {
        tenantName: "Sam Lee",
        phone: "0400000000",
        email: "sam@example.com",
        address: "12 Smith St",
        description: "Leaking tap",
        workOrderNumber: "WO-9",
        voucher: "EMB-1",
        pmAgency: "Ray White",
        pmName: "Pat Manager",
        tenants: [{ name: "Sam Lee", phone: "0400000000", email: "sam@example.com" }],
      },
    }),
  );
  if (!draft) throw new Error("draft missing");
  assert.equal(draft.step, "check");
  assert.equal(draft.business, "emoro");
  assert.equal(draft.tenants[1]?.email, "alex@example.com");
  assert.equal(draft.pmAgency, "Ray White");
  assert.equal(draft.voucher, "EMB-1");
  assert.equal(draft.read?.pmName, "Pat Manager");
  assert.equal(draft.screenshotCount, 2);
  assert.equal(newJobDraftDirty(draft), true);
  assert.equal(parseNewJobDraft("{"), null);
  assert.equal(parseNewJobDraft(JSON.stringify({ step: "capture" })), null);
  assert.equal(parseNewJobDraft(JSON.stringify({ step: "check", business: "", address: "1 Test St" }))?.step, "capture");

  const hold = parseNewJobIntroHold(
    JSON.stringify({
      business: "emporo",
      tenants: [{ name: "Sam", phone: "1", email: "sam@example.com" }],
      result: {
        ok: true,
        jobId: "abc",
        jobUrl: "https://www.notion.so/abc",
        address: "12 Smith St",
        desc: "Leaking tap",
        pmAgency: "Ray White",
        description: "Notion text",
      },
    }),
  );
  if (!hold) throw new Error("intro hold missing");
  assert.equal(hold.business, "emporo");
  assert.equal(hold.result.desc, "Leaking tap");
  assert.equal(hold.result.pmAgency, "Ray White");
  assert.equal(hold.result.description, "Notion text");
  assert.equal(parseNewJobIntroHold(JSON.stringify({ business: "emoro", result: {} })), null);
});

test("a leave draft keeps the checklist for the same visit", () => {
  const draft = parseLeaveDraft(
    JSON.stringify({
      jobId: "job-1",
      step: "details",
      checked: ["Before-and-after photos taken", "Not a real item"],
      outcome: "return",
      notes: "Gate code 1234",
      issues: "Loose tile",
      photoCount: 2,
      includeVoucher: "1",
    }),
  );
  if (!draft) throw new Error("leave draft missing");
  assert.equal(draft.step, "details");
  assert.equal(draft.outcome, "return");
  assert.equal(draft.includeVoucher, true);
  assert.deepEqual(draft.checked, ["Before-and-after photos taken"]);
  assert.equal(draft.notes, "Gate code 1234");
  assert.equal(draft.photoCount, 2);
  assert.equal(leaveDraftDirty(draft), true);
  assert.equal(parseLeaveDraft("{"), null);
    assert.equal(parseLeaveDraft(JSON.stringify({ jobId: "job-1", step: "checklist" })), null);
    assert.equal(parseLeaveDraft(JSON.stringify({ jobId: "job-1", step: "details", outcome: "complete" }))?.includeVoucher, false);
});

test("reading screenshots uses the new-job webhook without creating fields", async () => {
  useEnv();
  const { readScreenshots } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  let sent: FormData | null = null;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent = init?.body instanceof FormData ? init.body : null;
    return jsonResponse({
      ok: true,
      mode: "readScreenshots",
      business: "emoro",
      businessGuess: "emoro",
      tenantName: "Sam Lee",
      phone: "0412345678",
      email: "sam@example.com",
      address: "12 Smith St",
      description: "Leaking tap",
      workOrderNumber: "WO-9",
      voucher: "EMB-123456",
      tenant2Name: "",
      phone2: "",
      email2: "",
      pmName: "Pat PM",
      pmAgency: "Agency",
      pmEmail: "pm@agency.com",
      pmPhone: "0400000000",
    });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emoro");
    form.set("voucher", " emb-123456 ");
    form.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const result = await readScreenshots(form);
    assert.equal(result.status, 200);
    assert.ok(sent);
    const body = sent as unknown as FormData;
    assert.equal(body.get("secret"), SECRET);
    assert.equal(body.get("mode"), "readScreenshots");
    assert.equal(body.get("business"), "emoro");
    assert.equal(body.get("voucher"), "EMB-123456");
    assert.equal(body.getAll("images").length, 1);
    assert.equal(body.has("tenantName"), false);
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.tenantName, "Sam Lee");
    assert.equal(result.body.address, "12 Smith St");
    assert.equal(result.body.voucher, "EMB-123456");
    assert.equal(result.body.businessGuess, "emoro");
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = (async () => new Response("not json", { status: 200, headers: { "content-type": "text/plain" } })) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emporo");
    form.append("images", new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "shot.jpg", { type: "image/jpeg" }));
    const failed = await readScreenshots(form);
    assert.equal(failed.status, 502);
    if (failed.body.ok) throw new Error("expected a failed read");
    assert.equal(failed.body.error, "unreadable");
    assert.equal(failed.body.message, screenshotReadFallback);
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = (async () => jsonResponse({ ok: false, error: "unauthorized" }, 401)) as typeof fetch;
  try {
    const form = new FormData();
    form.set("business", "emoro");
    const denied = await readScreenshots(form);
    assert.equal(denied.status, 502);
    if (denied.body.ok) throw new Error("expected a rejected key");
    assert.equal(denied.body.error, "webhook_unauthorized");
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
    if (file.endsWith(`${join("jobs-app", "invoice.ts")}`)) continue;
    const source = readFileSync(file, "utf8").replace(/const chinese = \/[\s\S]*?\);/, "");
    assert.equal(/[\u4e00-\u9fff]/.test(source), false, file);
  }
  const header = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8");
  assert.equal(header.includes("/jobs"), false);
  assert.equal(header.includes('role="separator"'), true);
  assert.equal(footer.includes("/jobs"), false);
  assert.equal(footer.includes("Internal Login"), false);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}
