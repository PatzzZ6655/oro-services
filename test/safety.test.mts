import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { hrcwItems, latestLicences, licenceStatus, validateSafety } from "@/lib/reports/safety";
import { buildSafetyPdf } from "@/lib/reports/safety-pdf";

const now = new Date("2026-11-14T03:00:00.000Z");
const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function signed(data: FormData, prefix = "worker") {
  data.set("company", "emoro");
  data.set("date", "2026-11-14");
  data.set("address", "12 Example Street");
  data.set(`${prefix}.0.name`, "Pat Zee");
  data.set(`${prefix}.0.date`, "2026-11-14");
  data.set(`${prefix}.0.signature`, signature);
}

test("the high risk list follows the Victorian regulation", () => {
  assert.equal(hrcwItems.length, 18);
  assert.ok(hrcwItems.some((item) => /2 metres/.test(item.label)));
  assert.ok(hrcwItems.some((item) => /1\.5 metres/.test(item.label)));
  assert.ok(hrcwItems.some((item) => /asbestos/i.test(item.label)));
});

test("a SWMS needs the work category, a step, and a signature", () => {
  const data = new FormData();
  signed(data);
  data.set("jobNumber", "100");
  data.set("work", "Replace the roof sheet");
  data.set("emergency", "Call 000. First aid kit is in the ute.");
  assert.equal(validateSafety("swms", data, now).ok, false);
  data.set("hrcw.fall", "yes");
  data.set("step.0.step", "Set up the ladder");
  data.set("step.0.hazard", "Fall");
  data.set("step.0.control", "Tie the ladder off");
  const filed = validateSafety("swms", data, now);
  assert.equal(filed.ok, true);
  if (filed.ok) {
    assert.equal(filed.value.signs.length, 1);
    assert.equal(filed.value.steps?.length, 1);
  }
  data.set("worker.1.name", "Alex Lee");
  data.set("worker.1.date", "2026-11-14");
  data.set("worker.1.signature", signature);
  const both = validateSafety("swms", data, now);
  assert.equal(both.ok, true);
  if (both.ok) assert.equal(both.value.signs.length, 2);
});

test("a heights fail needs a comment and a photo", () => {
  const data = new FormData();
  signed(data);
  for (const id of ["ladder-condition", "ladder-setup", "scaffold-tag", "scaffold-access", "roof-edge", "harness", "anchor"]) {
    data.set(`height.${id}`, "pass");
  }
  data.set("height.harness", "fail");
  const bare = validateSafety("heights", data, now);
  assert.equal(bare.ok, false);
  if (!bare.ok) {
    assert.equal(bare.errors["height.harness.comment"], "Add a comment for this fail.");
    assert.equal(bare.errors["height.harness.photos"], "Add a photo for this fail.");
  }
  data.set("height.harness.comment", "Stitching is worn.");
  data.append("itemPhoto.height.harness", new File([Uint8Array.of(0xff, 0xd8, 0xff)], "harness.jpg", { type: "image/jpeg" }));
  assert.equal(validateSafety("heights", data, now).ok, true);
});

test("an incident keeps the WorkSafe note on the record", () => {
  const data = new FormData();
  signed(data);
  data.set("time", "09:30");
  data.set("kindOf", "incident");
  data.set("what", "A sheet slipped off the roof.");
  data.set("preserved", "yes");
  const filed = validateSafety("incident", data, now);
  assert.equal(filed.ok, true);
  if (filed.ok) assert.match(filed.value.note ?? "", /does not send that notice/);
});

test("licence dates are marked and the newest record for a worker is kept", () => {
  assert.equal(licenceStatus("2026-11-01", "2026-11-14"), "expired");
  assert.equal(licenceStatus("2026-12-01", "2026-11-14"), "soon");
  assert.equal(licenceStatus("2027-06-01", "2026-11-14"), "current");
  const rows = latestLicences([
    { id: "1", name: "Pat Zee", company: "emoro", whiteCard: "1", licence: "Old", expiry: "2026-01-01", created: "2026-01-01T00:00:00.000Z" },
    { id: "2", name: "pat zee", company: "emoro", whiteCard: "1", licence: "New", expiry: "2027-01-01", created: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.licence, "New");
});

test("a Take 5 PDF carries the company and stays a single document", async () => {
  const data = new FormData();
  signed(data);
  data.set("company", "emporo");
  data.set("task", "Fix the gutter");
  for (const id of ["task", "people", "equipment", "environment", "stop"]) data.set(`take.${id}`, "yes");
  const filed = validateSafety("take-5", data, now);
  assert.equal(filed.ok, true);
  if (!filed.ok) return;
  const bytes = await buildSafetyPdf(filed.value);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getAuthor(), "Emporo Plumbing");
  assert.equal(doc.getCreator(), "Emporo Plumbing Pty Ltd");
  assert.match(doc.getTitle() ?? "", /Take 5/);
  assert.equal(doc.getPageCount(), 1);
});

test("the staff manifest stays inside the portal", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/internal/manifest.webmanifest", import.meta.url), "utf8")) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
  };
  assert.equal(manifest.name, "ORO Staff");
  assert.equal(manifest.short_name, "ORO");
  assert.equal(manifest.start_url, "/internal");
  assert.equal(manifest.scope, "/internal");
  assert.equal(manifest.display, "standalone");
});
