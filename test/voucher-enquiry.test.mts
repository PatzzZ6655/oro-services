import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addCalendarDays, appointmentBounds, windowsForDate } from "@/lib/appointments";
import { acceptedVoucherCode, enquiryMailto, enquiryText, parseEnquiry, voucherHint } from "@/lib/enquiry";

function enquiry(brand: string, voucher = ""): FormData {
  const data = new FormData();
  data.set("name", "Alex Customer");
  data.set("email", "alex@example.com");
  data.set("suburb", "Richmond");
  data.set("brand", brand);
  data.set("service", brand === "emoro" ? "general-construction" : brand === "emporo" ? "plumbing" : "unsure");
  data.set("description", "We need a small job quoted this month.");
  if (brand === "emporo") {
    const { min } = appointmentBounds();
    const second = addCalendarDays(min, 1);
    data.set("option1Date", min);
    data.set("option1Window", windowsForDate(min)[0].id);
    data.set("option2Date", second);
    data.set("option2Window", windowsForDate(second)[0].id);
  }
  if (voucher) data.set("voucher", voucher);
  return data;
}

test("a matching code is normalised into the email and a bad code is left out", () => {
  const emoro = parseEnquiry(enquiry("emoro", "  emb-12 3456  "));
  assert.equal(emoro.ok, true);
  if (!emoro.ok) return;
  assert.equal(emoro.value.voucher, "EMB-123456");
  assert.match(enquiryText(emoro.value), /Voucher code: EMB-123456/);
  assert.match(decodeURIComponent(enquiryMailto(emoro.value).split("body=")[1] ?? ""), /Voucher code: EMB-123456/);

  const wrongPrefix = parseEnquiry(enquiry("emoro", "EMP-654321"));
  const blank = parseEnquiry(enquiry("emoro"));
  const shapeless = parseEnquiry(enquiry("emporo", "hello"));
  const emporo = parseEnquiry(enquiry("emporo", "emp-654321"));
  const general = parseEnquiry(enquiry("general", "EMB-123456"));
  for (const result of [wrongPrefix, blank, shapeless, general]) {
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.voucher, undefined);
    assert.equal(enquiryText(result.value).includes("Voucher code:"), false);
  }
  assert.equal(emporo.ok, true);
  if (!emporo.ok) return;
  assert.equal(emporo.value.voucher, "EMP-654321");
  assert.equal(emporo.value.appointments?.length, 2);
});

test("hints stay gentle and follow the selected brand", () => {
  assert.equal(voucherHint("emoro", ""), "Optional. Emoro codes start with EMB-.");
  assert.equal(voucherHint("emporo", "EMB-123456"), "We'll send the enquiry without this code. Emporo codes start with EMP-.");
  assert.equal(voucherHint("emoro", "EMB-123456"), null);
  assert.equal(voucherHint("general", "EMB-123456"), null);
  assert.equal(acceptedVoucherCode("emoro", "EMB-"), null);
  assert.equal(acceptedVoucherCode("emporo", "EMP-654321"), "EMP-654321");

  const form = readFileSync(new URL("../src/components/enquiry-form.tsx", import.meta.url), "utf8");
  assert.match(form, /placeholder=\{brand === "emoro" \? "EMB-…" : "EMP-…"\}/);
  assert.match(form, /brand === "emoro" \|\| brand === "emporo"/);
  assert.equal(form.includes("MAKE_"), false);
});
