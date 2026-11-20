import assert from "node:assert/strict";
import test from "node:test";
import { JOBS_COOKIE, signJobsSession } from "@/lib/jobs-app/session";
import { applyVoucherStatus, canApplyVoucher, notionPageId, voucherNote, voucherSmsTemplates } from "@/lib/jobs-app/voucher";

const SECRET = "test-make-secret";
const PAGE = "0123456789abcdef0123456789abcdef";

function useEnv() {
  process.env.JOBS_ALLOWED_EMAILS = "pat.z@orosvc.com";
  process.env.JOBS_SESSION_SECRET = "test-session-secret-value";
  process.env.MAKE_SHORTCUTS_SECRET = SECRET;
  process.env.MAKE_JOBS_TODAY_URL = "http://127.0.0.1:9/today";
  process.env.MAKE_DEPART_URL = "http://127.0.0.1:9/depart";
  process.env.MAKE_LEAVE_URL = "http://127.0.0.1:9/leave";
  process.env.MAKE_NEWJOB_URL = "http://127.0.0.1:9/new";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("notion page ids keep the last 32 hex characters", () => {
  assert.equal(notionPageId(`https://app.notion.com/p/Kitchen-leak-${PAGE}?pvs=204#comments`), PAGE);
  assert.equal(notionPageId(`https://www.notion.so/${PAGE}`), PAGE);
  assert.equal(notionPageId("01234567-89ab-cdef-0123-456789abcdef"), "0123456789abcdef0123456789abcdef");
  assert.equal(notionPageId(PAGE.toUpperCase()), PAGE);
  assert.equal(notionPageId(`https://www.notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/${PAGE}`), PAGE);
  assert.equal(notionPageId("abc"), null);
  assert.equal(notionPageId(""), null);
  assert.equal(notionPageId("   "), null);
});

test("unknown voucher statuses become none, and a failed mark is a warning", () => {
  assert.equal(applyVoucherStatus("invoiceIssued"), "invoiceIssued");
  assert.equal(applyVoucherStatus("jobHasVoucher"), "jobHasVoucher");
  assert.equal(applyVoucherStatus("jobNotFound"), "jobNotFound");
  assert.equal(applyVoucherStatus("surprise"), "none");
  assert.equal(
    voucherNote("error", "EMB-1", "")?.text,
    "The voucher could not be marked as used, so it was NOT applied. The job was still created. Use Apply voucher on this job.",
  );
  assert.equal(canApplyVoucher({ hasJob: true, code: "EMB-1", pending: true, redeemed: false }), false);
  assert.equal(canApplyVoucher({ hasJob: true, code: "EMB-1", pending: false, redeemed: true }), false);
  assert.equal(canApplyVoucher({ hasJob: false, code: "EMB-1", pending: false, redeemed: false }), false);
  assert.equal(canApplyVoucher({ hasJob: true, code: "  ", pending: false, redeemed: false }), false);
  assert.equal(canApplyVoucher({ hasJob: true, code: "EMP-1", pending: false, redeemed: false }), true);
  const [approved, reduced] = voucherSmsTemplates(" emb-1 ");
  assert.equal(approved, "Thanks [Name], your job is approved. Voucher emb-1 has been applied (-$60). Final price: $[X] incl GST.");
  assert.equal(
    reduced,
    "Hi [Name], as discussed we've reduced the price to $[X] incl GST. As vouchers can't be combined with other discounts, voucher emb-1 is no longer valid.",
  );
  const [blankApproved] = voucherSmsTemplates("  ");
  assert.equal(blankApproved.includes("[CODE]"), true);
  assert.equal(blankApproved.includes("[Name]"), true);
  assert.equal(blankApproved.includes("[X]"), true);
});

test("apply voucher posts mode and a 32-hex id, and maps a failed update", async () => {
  useEnv();
  const { applyVoucher } = await import("@/lib/jobs-app/webhooks");
  const original = globalThis.fetch;
  const sent: { url: string; body: Record<string, string> } = { url: "", body: {} };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.url = String(url);
    sent.body = JSON.parse(String(init?.body)) as Record<string, string>;
    return jsonResponse({
      ok: true,
      mode: "applyVoucher",
      business: "emoro",
      brand: "Emoro Building",
      jobId: PAGE,
      jobUrl: "https://www.notion.so/job",
      jobTitle: "Hot water",
      voucherStatus: "redeemed",
      voucherCode: "EMB-123456",
      voucherValue: 60,
      voucherBusiness: "emporo",
      voucherRedeemedDate: "",
      voucherMessage: "Applied.",
      noteWritten: true,
    });
  }) as typeof fetch;
  try {
    const result = await applyVoucher(`https://app.notion.com/p/Slug-${PAGE}?pvs=204`, " emb-123456 ", "emoro");
    assert.equal(sent.url, "http://127.0.0.1:9/new");
    assert.equal(sent.body.mode, "applyVoucher");
    assert.equal(sent.body.jobId, PAGE);
    assert.equal(sent.body.voucher, "EMB-123456");
    assert.equal(sent.body.business, "emoro");
    assert.equal(result.status, 200);
    if (!result.body.ok) throw new Error(result.body.message);
    assert.equal(result.body.voucherValue, 60);
    assert.equal(result.body.noteWritten, true);
    assert.equal(JSON.stringify(result.body).includes(SECRET), false);
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = (async () =>
    jsonResponse({ ok: false, error: "voucherUpdateFailed", voucherCode: "EMB-1", voucherMessage: `Could not write ${SECRET}` }, 502)) as typeof fetch;
  try {
    const failed = await applyVoucher(PAGE, "EMB-1", "emoro");
    assert.equal(failed.status, 502);
    assert.equal(failed.body.ok, false);
    if (failed.body.ok) return;
    assert.equal(failed.body.error, "voucherUpdateFailed");
    assert.equal(failed.body.message, "Could not write ");
    assert.equal(failed.body.message.includes(SECRET), false);
  } finally {
    globalThis.fetch = original;
  }

  const badJob = await applyVoucher("abc", "EMB-1", "emoro");
  assert.equal(badJob.status, 400);
  if (badJob.body.ok) return;
  assert.equal(badJob.body.error, "bad_job");
  const badCode = await applyVoucher(PAGE, "   ", "emporo");
  assert.equal(badCode.status, 400);
  if (badCode.body.ok) return;
  assert.equal(badCode.body.error, "bad_code");
});

test("the voucher route rejects a signed-out request", async () => {
  useEnv();
  const route = (await import("@/app/jobs/api/voucher/route")).POST;
  const loggedOut = await route(
    new Request("http://localhost:3000/jobs/api/voucher", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ jobRef: PAGE, code: "EMB-1", business: "emoro" }),
    }),
  );
  assert.equal(loggedOut.status, 401);

  const cookie = `${JOBS_COOKIE}=${encodeURIComponent(await signJobsSession("pat.z@orosvc.com"))}`;
  const headers = new Headers({ origin: "http://localhost:3000", cookie, "content-type": "application/json" });
  const bad = await route(
    new Request("http://localhost:3000/jobs/api/voucher", {
      method: "POST",
      headers,
      body: JSON.stringify({ code: "EMB-1" }),
    }),
  );
  assert.equal(bad.status, 400);
});
