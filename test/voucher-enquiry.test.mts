import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addCalendarDays, appointmentBounds, windowsForDate } from "@/lib/appointments";
import { acceptedVoucherCode, enquiryMailto, enquiryText, parseEnquiry, voucherHint, voucherLine } from "@/lib/enquiry";

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
  assert.match(enquiryText(emoro.value), /Voucher code: EMB-123456 \(Emoro voucher\)/);
  assert.match(decodeURIComponent(enquiryMailto(emoro.value).split("body=")[1] ?? ""), /Voucher code: EMB-123456 \(Emoro voucher\)/);

  const eitherBrand = parseEnquiry(enquiry("emoro", "EMP-654321"));
  const blank = parseEnquiry(enquiry("emoro"));
  const shapeless = parseEnquiry(enquiry("emporo", "hello"));
  const emporo = parseEnquiry(enquiry("emporo", "emb-123456"));
  const general = parseEnquiry(enquiry("general", "EMB-123456"));
  for (const result of [blank, shapeless, general]) {
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.voucher, undefined);
    assert.equal(enquiryText(result.value).includes("Voucher code:"), false);
  }
  assert.equal(eitherBrand.ok, true);
  if (!eitherBrand.ok) return;
  assert.equal(eitherBrand.value.voucher, "EMP-654321");
  assert.match(enquiryText(eitherBrand.value), /Voucher code: EMP-654321 \(Emporo voucher\)/);
  assert.equal(voucherLine("EMP-654321"), "Voucher code: EMP-654321 (Emporo voucher)");
  assert.equal(emporo.ok, true);
  if (!emporo.ok) return;
  assert.equal(emporo.value.voucher, "EMB-123456");
  assert.match(enquiryText(emporo.value), /Voucher code: EMB-123456 \(Emoro voucher\)/);
  assert.equal(emporo.value.appointments?.length, 2);
});

test("hints stay gentle and follow the selected brand", () => {
  assert.equal(voucherHint("emoro", ""), "Optional. Codes start with EMB- or EMP-.");
  assert.equal(voucherHint("emporo", "HELLO"), "We'll send the enquiry without this code. Codes start with EMB- or EMP-.");
  assert.equal(voucherHint("emoro", "EMP-654321"), null);
  assert.equal(voucherHint("general", "EMB-123456"), null);
  assert.equal(acceptedVoucherCode("emoro", "EMB-"), null);
  assert.equal(acceptedVoucherCode("emporo", "EMB-123456"), "EMB-123456");
  assert.equal(acceptedVoucherCode("general", "EMP-654321"), null);

  const form = readFileSync(new URL("../src/components/enquiry-form.tsx", import.meta.url), "utf8");
  assert.match(form, /placeholder="EMB- or EMP- code"/);
  assert.match(form, /brand === "emoro" \|\| brand === "emporo"/);
  assert.equal(form.includes("MAKE_"), false);
});
