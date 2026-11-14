import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { barLinks, indexablePaths, menuLinks } from "@/lib/content";

const clauses = [
  "About these terms",
  "These terms apply to work carried out by ORO Services through Emoro Building and Emporo Plumbing. They apply when the customer accepts a quote, confirms a booking, or allows us to start work.",
  "Quotes and acceptance",
  "Quotes are valid for 14 days from the date issued, unless a shorter period is stated on the quote.",
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
  "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot legally be excluded under the Australian Consumer Law or other applicable law.",
  "Governing law",
  "These terms are governed by the laws of Victoria, Australia.",
];

test("the terms page keeps the approved wording and stays public", () => {
  const page = readFileSync(new URL("../src/app/terms/page.tsx", import.meta.url), "utf8");
  assert.match(page, /title: "Terms and Conditions"/);
  assert.match(page, /path: "\/terms"/);
  assert.match(page, /Last updated: 15 November 2026/);
  assert.match(page, /Terms and Conditions \(ORO Services: Emoro Building and Emporo Plumbing\)/);
  for (const clause of clauses) assert.equal(page.includes(clause), true, clause);
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
