import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { barLinks, indexablePaths, menuLinks } from "@/lib/content";

const clauses = [
  "About these terms",
  "These terms apply to work carried out by ORO Services through Emoro Building and Emporo Plumbing. They apply when the customer accepts a quote, confirms a booking, or allows us to start work.",
  "Quotes and acceptance",
  "Quotes are valid for 14 days from the date issued, unless a shorter period is stated on the quote.",
  "except urgent make-safe work.",
  "Prices and GST",
  "Prices include GST unless stated otherwise.",
  "Call-outs, access and after-hours",
  "The customer or their property manager should give at least 24 hours' notice to cancel or reschedule.",
  "Payment",
  "Payment is due within 30 days of the invoice date, or within 45 days if agreed in writing for an approved account.",
  "Late payment",
  "Overdue amounts may incur interest at the rate prescribed under the Penalty Interest Rates Act 1983 (Vic), plus reasonable costs of recovery.",
  "Materials",
  "Materials we supply remain our property until paid in full.",
  "Workmanship and consumer rights",
  "If you notice a problem with our workmanship, tell us promptly. We will inspect it and, where it is our responsibility, fix it at no cost to you. Parts and fixtures follow the manufacturer's warranty.",
  "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot legally be excluded under the Australian Consumer Law or other applicable law.",
  "Governing law",
  "These terms are governed by the laws of Victoria, Australia. We and the customer submit to the non-exclusive jurisdiction of the courts of Victoria.",
  "Severability",
  "If any part of these terms cannot be enforced, the rest still applies.",
  "Matching finishes",
  "We will take reasonable care, but an exact match to existing colours, tiles, render, paint, timber or other finishes is not guaranteed, including because of ageing, light, wear or batch differences.",
  "Customer-supplied materials",
  "If the customer supplies materials or fixtures, we will install them with reasonable care, but we do not warrant their quality, suitability, colour or performance. If items are missing, incorrect or unsuitable, we will explain any extra labour and get your approval before charging it.",
  "We may decline to install items that are not WaterMark-certified or otherwise not compliant with the relevant standards, or that we reasonably consider unsafe.",
  "Product supply and substitutions",
  "Where we supply products, the final brand or model may depend on supplier availability and compatibility with existing services and site conditions. If a listed item is unavailable or not compatible, we will tell you and agree any substitute or change in cost before we proceed.",
  "Pre-existing conditions",
  "We are not responsible for pre-existing defects, settlement or other movement, moisture, or work done by others before we started, except to the extent our work causes new damage.",
  "Investigative and diagnostic repairs",
  "Some faults, such as leaks, intermittent defects and concealed issues, require a process of elimination, as the cause may not be visible or may be in more than one location. Where we repair or treat an area identified during an attendance, no warranty can be provided that this will completely resolve the issue until it has been monitored under normal conditions (for roof leaks, after suitable rainfall). If the issue continues, further investigation and/or repair may be required. We will explain any extra cost and get your approval before that work goes ahead, as set out in Variations. A continuing issue after an investigative repair is not, of itself, a defect in our workmanship.",
  "Variations",
  "Changes to the quoted scope, including customer-requested changes, are variations. We will explain any extra cost and get your approval before doing that work, except urgent make-safe work. Approved variations are charged at the agreed price.",
  "Incidental repairs: During the works we may identify a defect in an existing component that is directly connected to, or affected by, the quoted works and that was not apparent at the time of quoting (for example, a failed non-return valve or a leaking pressure/temperature relief valve on the hot water system being serviced). Such components are often already worn, scaled or near the end of their service life, and the defect may only become apparent once they are handled; it is a pre-existing condition unless caused by our work. Where the additional cost of rectifying it (parts and labour) is $176 (including GST) or less, we may carry out the repair without seeking your prior approval, and it will be itemised separately on your invoice. This does not apply to materials or fixtures supplied by the customer, and a change of brand or model still needs your agreement under Product supply and substitutions. Defects in components unrelated to the quoted works, or repairs that would exceed this amount, will not proceed without your approval, except for urgent make-safe work under the Variations clause.",
  "Asbestos and hazardous materials",
  "If we suspect asbestos or other hazardous material, we will stop work in the affected area. Testing and removal by appropriately licensed specialists is an extra cost. We will explain that cost and get your approval before that work goes ahead.",
  "Work at heights",
  "Work at heights is carried out only with appropriate safe access, such as scaffolding, an elevating work platform or edge protection, as required by Victorian occupational health and safety law. If the required access equipment is not included in the quote, we will explain the extra cost and get your approval before proceeding. We may decline or pause work that cannot be done safely.",
  "Confined spaces",
  "Work in a confined space is carried out only with the permits and controls required by Victorian occupational health and safety law. Examples include a pit, a tank, or a subfloor or roof void that is a confined space under the Occupational Health and Safety Regulations 2017 (Vic). If we identify a confined space that was not in the quote, we will stop that work until those controls are arranged. We will explain any extra cost and get your approval before we proceed.",
  "Thank-you vouchers",
  "After a completed job we may send a thank-you voucher worth $60 off a future job with Emoro Building or Emporo Plumbing. Emoro codes start with EMB- and Emporo codes start with EMP-.",
  "Valid for 3 months from the issue date shown on the voucher. The job must be booked within that time.",
  "It applies to jobs of $150 or more (before the voucher is applied).",
  "One voucher per job. It can be used once, and can't be exchanged for cash, split or combined with other offers.",
  "Quote the code when booking. The voucher is used once it is applied to a new job and can't be reused, even if that job is cancelled or doesn't go ahead.",
  "The voucher is a thank-you and is not conditional on leaving a review.",
];

test("the terms page keeps the approved wording and stays public", () => {
  const page = readFileSync(new URL("../src/app/terms/page.tsx", import.meta.url), "utf8");
  assert.match(page, /title: "Terms and Conditions"/);
  assert.match(page, /path: "\/terms"/);
  assert.match(page, /Last updated: 20 November 2026/);
  assert.equal(page.includes("Last updated: 19 November 2026"), false);
  assert.match(page, />Terms and Conditions</);
  assert.match(page, /ORO Services · Emoro Building and Emporo Plumbing/);
  const subtitleAt = page.indexOf("ORO Services · Emoro Building and Emporo Plumbing");
  const clausesAt = page.indexOf('className="mt-10 space-y-10"');
  const updatedAt = page.indexOf("Last updated: 20 November 2026");
  assert.ok(subtitleAt < clausesAt && clausesAt < updatedAt);
  assert.ok(page.indexOf('heading: "Thank-you vouchers"') < updatedAt);
  assert.ok(page.indexOf('heading: "Confined spaces"') < page.indexOf('heading: "Thank-you vouchers"'));
  assert.match(page, /text-xs text-slate-500[^>]*>Last updated: 20 November 2026/);
  const vouchers = page.slice(page.indexOf('heading: "Thank-you vouchers"'), updatedAt);
  assert.equal(vouchers.includes("ABN"), false);
  assert.equal(vouchers.includes("reissue"), false);
  assert.equal(page.includes("Terms and Conditions (ORO Services: Emoro Building and Emporo Plumbing)"), false);
  for (const clause of clauses) assert.equal(page.includes(clause), true, clause);
  assert.ok(page.indexOf('heading: "Governing law"') < page.indexOf('heading: "Matching finishes"'));
  assert.ok(
    page.indexOf('heading: "Pre-existing conditions"') <
      page.indexOf('heading: "Investigative and diagnostic repairs"') &&
      page.indexOf('heading: "Investigative and diagnostic repairs"') < page.indexOf('heading: "Variations"'),
  );
  assert.equal(/accept no liability|no liability|forfeiture|warranty void|void the warranty/i.test(page), false);
  assert.equal(/within \d+ hours/.test(page) && /respond/.test(page), false);

  const paths = indexablePaths();
  assert.equal(paths.some((entry) => entry.path === "/terms"), true);
  assert.equal(paths.some((entry) => entry.path.startsWith("/internal")), false);
  const headerHrefs = [...barLinks, ...menuLinks].map((link) => link.href as string);
  assert.equal(headerHrefs.includes("/terms"), false);

  const footer = readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8");
  assert.match(footer, /href="\/terms"/);
  assert.match(footer, />\s*Terms\s*</);
});
