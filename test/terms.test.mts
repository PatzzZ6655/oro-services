import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { barLinks, indexablePaths, menuLinks } from "@/lib/content";

const clauses = [
  "About these terms",
  "These terms apply to work carried out under the Emoro Building brand by Emoro Building Pty Ltd, and under the Emporo Plumbing brand by Emporo Plumbing Pty Ltd. ORO Services is the trading name we use for both brands. They apply when the customer accepts a quote, confirms a booking, or allows us to start work.",
  'In these terms, "we", "us" and "our" mean the company named on the quote or tax invoice for the job (Emoro Building Pty Ltd or Emporo Plumbing Pty Ltd).',
  "Quotes and acceptance",
  "Quotes are valid for 14 days from the date issued, unless a shorter period is stated on the quote.",
  "any extra work or cost needs approval under Variations before we continue, except urgent make-safe work and incidental repairs.",
  "Prices and GST",
  "Prices include GST unless stated otherwise. Tax invoices will include the information required by the Australian Taxation Office, including the customer's name or ABN on jobs of $1,000 or more.",
  "Call-outs, access and after-hours",
  "If the customer cancels or reschedules a booking with less than 24 hours' notice, we may charge a call-out fee to cover our reasonable time and travel already committed, up to a maximum of $176 (including GST).",
  "The customer or their property manager is responsible for arranging safe access, including keys, codes and tenant notice.",
  "Appointment times",
  "we are not liable for any loss, cost or time off work caused by a delayed or rescheduled appointment where the delay or rescheduling is caused by one of the reasons listed above.",
  "Payment",
  "Payment is due within 30 days of the invoice date, or within 45 days if agreed in writing for an approved account.",
  "The customer confirms that they are the owner, or have the authority of the owner or the owners corporation, to approve the work, and is responsible for payment, unless a named owner has accepted the quote in writing.",
  "Late payment",
  "Overdue amounts may incur interest at the rate prescribed under the Penalty Interest Rates Act 1983 (Vic), plus reasonable costs of recovery.",
  "Cancellation after acceptance",
  "for materials already ordered for the job, 25% of the cost of those materials plus any delivery or transport costs already incurred.",
  "Materials",
  "Materials we supply remain our property until paid in full.",
  "Workmanship and consumer rights",
  "If you notice a problem with our workmanship, tell us promptly. We will inspect it and, where it is our responsibility, fix it at no cost to you.",
  "Contact: info@orosvc.com · www.orosvc.com. It covers problems with our workmanship that appear within 6 months of the date we complete the work.",
  "Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. For major failures with the service, you are entitled:",
  "to cancel your service contract with us; and",
  "to a refund for the unused portion, or to compensation for its reduced value.",
  "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot legally be excluded under the Australian Consumer Law or other applicable law.",
  "Governing law",
  "These terms are governed by the laws of Victoria, Australia. We and the customer submit to the non-exclusive jurisdiction of the courts of Victoria.",
  "Severability",
  "If any part of these terms cannot be enforced, the rest still applies.",
  "Matching finishes",
  "We will take reasonable care, but an exact match to existing colours, tiles, render, paint, timber or other finishes is not guaranteed, including because of ageing, light, wear or batch differences.",
  "Customer-supplied materials",
  "any extra labour needs approval under Variations before we charge it.",
  "Product supply and substitutions",
  "any substitute or change in cost needs approval under Variations before we proceed.",
  "Pre-existing conditions",
  "We are not responsible for pre-existing defects, settlement or other movement, moisture, or work done by others before we started, except to the extent our work causes new damage.",
  "Investigative and diagnostic repairs",
  "Any extra cost needs approval under Variations before that work goes ahead.",
  "Variations",
  'or verbally and confirmed in writing ("approval under Variations").',
  "Urgent make-safe work means the minimum work needed to stop an immediate risk to people or immediate damage to property",
  "they want to be asked before any incidental repair is done.",
  "they can tell us within 14 days of the invoice date",
  "Asbestos and hazardous materials",
  "needs approval under Variations before that work goes ahead.",
  "Work at heights",
  "the extra cost needs approval under Variations before we proceed.",
  "Confined spaces",
  "Any extra cost needs approval under Variations before we proceed.",
  "Thank-you vouchers",
  "After a completed job we may send a thank-you voucher worth $60 off a future job of $150 or more, including GST, before the voucher is applied. A voucher can be used for work with either Emoro Building or Emporo Plumbing. Emoro codes start with EMB- and Emporo codes start with EMP-.",
  "Once a voucher is applied to a job, it is redeemed. It is not reused or reissued if the customer cancels the job or the job does not go ahead for a reason within the customer's control. If we cancel the job, the voucher is not treated as redeemed and stays valid until its original expiry date.",
  "A voucher cannot be combined with any other discount or price reduction on the same job.",
  "Complaints",
  "We will contact them within 14 days to discuss it and try to resolve it. This does not affect the customer's right to contact Consumer Affairs Victoria",
  "Privacy",
  "Our Privacy Policy at www.orosvc.com/privacy explains more.",
];

test("the terms page keeps the approved wording and stays public", () => {
  const page = readFileSync(new URL("../src/app/terms/page.tsx", import.meta.url), "utf8");
  assert.match(page, /title: "Terms and Conditions"/);
  assert.match(page, /path: "\/terms"/);
  assert.match(page, /Last updated: 24 November 2026/);
  assert.equal(page.includes("Last updated: 22 November 2026"), false);
  assert.equal(page.includes("Last updated: 21 November 2026"), false);
  assert.equal(page.includes("Last updated: 20 November 2026"), false);
  assert.ok(page.indexOf('heading: "Call-outs, access and after-hours"') < page.indexOf('heading: "Appointment times"'));
  assert.ok(page.indexOf('heading: "Appointment times"') < page.indexOf('heading: "Payment"'));
  assert.match(page, />Terms and Conditions</);
  assert.match(page, /ORO Services · Emoro Building and Emporo Plumbing/);
  const subtitleAt = page.indexOf("ORO Services · Emoro Building and Emporo Plumbing");
  const clausesAt = page.indexOf('className="mt-10 space-y-10"');
  const updatedAt = page.indexOf("Last updated: 24 November 2026");
  assert.ok(subtitleAt < clausesAt && clausesAt < updatedAt);
  assert.ok(page.indexOf('heading: "Thank-you vouchers"') < updatedAt);
  assert.ok(page.indexOf('heading: "Confined spaces"') < page.indexOf('heading: "Thank-you vouchers"'));
  assert.ok(page.indexOf('heading: "Thank-you vouchers"') < page.indexOf('heading: "Governing law"'));
  assert.ok(page.indexOf('heading: "Governing law"') < page.indexOf('heading: "Severability"'));
  assert.ok(page.indexOf('heading: "Severability"') < updatedAt);
  assert.match(page, /text-xs text-slate-500[^>]*>Last updated: 24 November 2026/);
  assert.ok(page.indexOf('heading: "Thank-you vouchers"') < page.indexOf('heading: "Complaints"'));
  assert.ok(page.indexOf('heading: "Complaints"') < page.indexOf('heading: "Privacy"'));
  assert.ok(page.indexOf('heading: "Privacy"') < page.indexOf('heading: "Governing law"'));
  const vouchers = page.slice(page.indexOf('heading: "Thank-you vouchers"'), page.indexOf('heading: "Complaints"'));
  assert.ok(vouchers.indexOf("Once a voucher is applied to a job, it is redeemed.") < vouchers.indexOf("A voucher cannot be combined"));
  assert.ok(vouchers.indexOf("A voucher cannot be combined") < vouchers.indexOf("The voucher is a thank-you"));
  assert.equal(vouchers.includes("can't be combined"), false);
  assert.equal(vouchers.includes("30 days"), false);
  assert.equal(vouchers.includes("void"), false);
  assert.equal(vouchers.includes("ABN"), false);
  assert.equal((page.match(/\bABN\b/g) ?? []).length, 1);
  assert.equal(/\b\d{2} \d{3} \d{3} \d{3}\b/.test(page), false);
  assert.equal(page.includes("0489"), false);
  const acl = "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot legally be excluded under the Australian Consumer Law or other applicable law.";
  assert.equal(page.split(acl).length, 2);
  assert.equal(page.includes("Nothing in these terms limits the customer's rights under the Australian Consumer Law."), false);
  assert.equal(page.includes("Terms and Conditions (ORO Services: Emoro Building and Emporo Plumbing)"), false);
  for (const clause of clauses) assert.equal(page.includes(clause), true, clause);
  assert.ok(page.indexOf('heading: "Matching finishes"') < page.indexOf('heading: "Thank-you vouchers"'));
  assert.equal(/\bMake\b/.test(page), false);
  assert.equal(/DBCA|registered builder|\binsurance\b|\bdeposit\b/i.test(page), false);
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
  assert.match(footer, /© 2026 ORO Services/);
  assert.equal(footer.includes("registered trademark"), false);
  assert.equal(footer.includes("Pty Ltd"), false);
});

test("the privacy page names the voucher code and keeps the enquiry in the inbox", () => {
  const page = readFileSync(new URL("../src/app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Last updated: 24 November 2026/);
  assert.match(
    page,
    /This page explains what ORO Services does with personal information, including details you send us through this website and the records we keep when we arrange and carry out jobs\. It is written for an Australian small business/,
  );
  assert.match(page, /Emoro Building \(Emoro Building Pty Ltd\) and Emporo Plumbing \(Emporo Plumbing Pty Ltd\)/);
  assert.match(page, /Job records, tenants and messages/);
  assert.match(page, /We do not use tenant details for marketing and we do not sell them\./);
  assert.match(page, /tax records are generally kept for 5 years/);
  assert.equal(page.includes("artificial intelligence"), false);
  const websiteAt = page.indexOf(">This website<");
  const jobsAt = page.indexOf(">Job records, tenants and messages<");
  const updated = page.indexOf("Last updated: 24 November 2026");
  assert.ok(websiteAt < jobsAt && jobsAt < updated);
  assert.match(
    page,
    /A voucher code, if you choose to give one\. On an Emoro Building or Emporo Plumbing enquiry the form accepts a code starting with EMB- or EMP-\. A blank or unusable code is not kept with the enquiry\./,
  );
  assert.match(
    page,
    /We email the message to the inbox for the brand you pick\. If you gave a usable voucher code, that code is included in the same email so it can be seen with the enquiry\. Sending the form does not apply the voucher to a job\./,
  );
  assert.match(page, /The form does not send the enquiry into a job database\./);
  assert.equal(page.includes("The form does not send the enquiry on to Make"), false);
  assert.equal(/\bMake\b/.test(page), false);
  assert.match(
    page,
    /The form sends it by email, through Google Workspace, to the inbox for the brand you pick, and it stays in that inbox\./,
  );
});
