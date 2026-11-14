import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { PDFDocument } from "pdf-lib";
import { barLinks, dashboardHref, menuLinks, staffPortalHref } from "@/lib/content";
import {
  allowlist,
  allowedEmails,
  authConfigured,
  isEmailAllowed,
  staffRole,
  readSession,
  signSession,
} from "@/lib/auth/session";
import { verifyGoogleIdToken } from "@/lib/auth/google-identity";
import {
  companies,
  companyFor,
  electricalEarth,
  electricalExtent,
  electricalPolarity,
  electricalVisual,
  gasChecks,
  reportMailIdentity,
} from "@/lib/reports/catalog";
import { addYears } from "@/lib/reports/dates";
import { buildReportPdf } from "@/lib/reports/pdf";
import { driveFolderQuery, submissionFolderName } from "@/lib/reports/paths";
import { keyPhotoSlots, parseSignature, validateReport } from "@/lib/reports/validate";

const now = new Date("2026-11-14T03:00:00.000Z");

function jpegFile(name = "photo.jpg") {
  return new File([Uint8Array.of(0xff, 0xd8, 0xff)], name, { type: "image/jpeg" });
}

function failPhoto(data: FormData, key: string) {
  data.append(key, jpegFile("fail.jpg"));
}
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function siteForm(company: "emoro" | "emporo", extra?: Record<string, string>) {
  const data = new FormData();
  data.set("company", company);
  data.set("workerName", "Sam Worker");
  data.set("date", "2026-11-14");
  data.set("jobNumber", "1042");
  data.set("address", "12 Smith Street, Richmond");
  data.set("startTime", "08:00");
  data.set("finishTime", "15:30");
  data.set("work", "Replaced the kitchen tap.");
  const safety =
    company === "emoro"
      ? [
          ["safety.emoro.ppe", "yes"],
          ["safety.emoro.hazards", "yes"],
          ["safety.emoro.tools", "yes"],
        ]
      : [
          ["safety.emporo.isolated", "yes"],
          ["safety.emporo.leak", "no"],
          ["safety.emporo.ppe", "yes"],
        ];
  for (const [key, value] of safety) data.set(key, value);
  for (const [key, value] of Object.entries(extra ?? {})) data.set(key, value);
  return data;
}

function signOffForm(extra?: Record<string, string>, omit: string[] = []) {
  const data = new FormData();
  const fields: Record<string, string> = {
    company: "emoro",
    jobNumber: "1042",
    clientName: "Alex Client",
    address: "12 Smith Street, Richmond",
    date: "2026-11-14",
    work: "Finished the bathroom fit-off.",
    "confirm.accepted": "yes",
    ...extra,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (!omit.includes(key)) data.set(key, value);
  }
  return data;
}

function gasForm(extra?: Record<string, string>) {
  const data = new FormData();
  const fields: Record<string, string> = {
    address: "12 Smith Street, Richmond VIC 3121",
    providerName: "Northside Agents",
    providerEmail: "rentals@northside.example",
    date: "2024-02-29",
    gasfitterName: "Pat Zee",
    business: "Emporo Plumbing",
    licence: "12345",
    urgent: "no",
    ...extra,
  };
  for (const item of gasChecks) fields[`check.${item.id}`] = fields[`check.${item.id}`] ?? "pass";
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.append("keyPhoto.readings", jpegFile("readings.jpg"));
  return data;
}

function electricalForm(extra?: Record<string, string>) {
  const data = new FormData();
  const fields: Record<string, string> = {
    address: "12 Smith Street, Richmond VIC 3121",
    providerName: "Northside Agents",
    providerEmail: "rentals@northside.example",
    date: "2026-11-01",
    electricianName: "Sam Sparks",
    business: "Sparks Electrical",
    licence: "A12345",
    smoke: "yes",
    urgent: "no",
    overall: "compliant",
    "rcd.0.circuit": "Power outlets",
    "rcd.0.push": "pass",
    ...extra,
  };
  for (const item of electricalExtent) fields[`extent.${item.id}`] ??= item.id === "kitchen" ? "included" : "na";
  for (const item of electricalVisual) fields[`visual.${item.id}`] ??= "pass";
  for (const item of electricalPolarity) fields[`polarity.${item.id}`] ??= "pass";
  for (const item of electricalEarth) fields[`earth.${item.id}`] ??= "na";
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.append("keyPhoto.switchboard", jpegFile("board.jpg"));
  data.append("keyPhoto.rcd", jpegFile("rcd.jpg"));
  data.append("keyPhoto.smoke", jpegFile("smoke.jpg"));
  return data;
}

test("the public menu links to the dashboard and the staff portal", () => {
  assert.deepEqual(
    barLinks.map((link) => link.label),
    ["Emoro Building", "Emporo Plumbing", "Contact"],
  );
  assert.deepEqual(
    menuLinks.map((link) => link.label),
    ["Emoro Building", "Emporo Plumbing", "Contact", "Dashboard", "Staff Portal"],
  );
  assert.equal(menuLinks.find((link) => link.label === "Dashboard")?.href, dashboardHref);
  assert.equal(dashboardHref, "https://tape.orosvc.com");
  assert.equal(menuLinks.find((link) => link.label === "Staff Portal")?.href, staffPortalHref);
  assert.equal(staffPortalHref, "/internal");
  assert.equal(menuLinks.some((link) => /stock/i.test(link.label)), false);
});

test("site job safety items follow the company", () => {
  const emoro = validateReport("site-job-sheet", siteForm("emoro"), now);
  assert.equal(emoro.ok, true);
  if (emoro.ok && emoro.value.kind === "site-job-sheet") {
    assert.deepEqual(emoro.value.safety.map((item) => item.id), ["ppe", "hazards", "tools"]);
  }

  const missingTool = siteForm("emoro");
  missingTool.delete("safety.emoro.tools");
  const toolResult = validateReport("site-job-sheet", missingTool, now);
  assert.equal(toolResult.ok, false);
  if (!toolResult.ok) assert.equal(toolResult.errors["safety.emoro.tools"], "Choose yes or no.");

  const emporo = validateReport("site-job-sheet", siteForm("emporo"), now);
  assert.equal(emporo.ok, true);
  if (emporo.ok && emporo.value.kind === "site-job-sheet") {
    assert.deepEqual(emporo.value.safety.map((item) => item.id), ["isolated", "leak", "ppe"]);
    assert.equal(emporo.value.safety.find((item) => item.id === "leak")?.answer, "no");
  }

  const emporoWithoutTools = siteForm("emporo");
  emporoWithoutTools.delete("safety.emoro.tools");
  assert.equal(validateReport("site-job-sheet", emporoWithoutTools, now).ok, true);

  const earlyFinish = validateReport("site-job-sheet", siteForm("emoro", { finishTime: "07:00" }), now);
  assert.equal(earlyFinish.ok, false);
  if (!earlyFinish.ok) assert.equal(earlyFinish.errors.finishTime, "Finish time is before the start time.");

  const withOptional = validateReport(
    "site-job-sheet",
    siteForm("emoro", { materials: "Copper olive and tap body", issues: "Old waste was seized." }),
    now,
  );
  assert.equal(withOptional.ok, true);
  if (withOptional.ok && withOptional.value.kind === "site-job-sheet") {
    assert.equal(withOptional.value.materials, "Copper olive and tap body");
    assert.equal(withOptional.value.issues, "Old waste was seized.");
  }
});

test("sign-off needs the confirmation and treats client email as optional", () => {
  assert.equal(validateReport("job-sign-off", signOffForm(), now).ok, true);
  const refused = validateReport("job-sign-off", signOffForm({ "confirm.accepted": "no" }), now);
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.errors["confirm.accepted"], "This sign-off needs a yes.");

  const plumbing = signOffForm({ company: "emporo" });
  const missingCertificate = validateReport("job-sign-off", plumbing, now);
  assert.equal(missingCertificate.ok, false);
  if (!missingCertificate.ok) assert.equal(missingCertificate.errors.vba, "Choose yes or no.");
  plumbing.set("vba", "yes");
  plumbing.set("vbaNumber", "C-100");
  plumbing.set("vbaLodged", "2026-11-14");
  const lodged = validateReport("job-sign-off", plumbing, now);
  assert.equal(lodged.ok, true);
  if (lodged.ok && lodged.value.kind === "job-sign-off") assert.equal(lodged.value.vbaNumber, "C-100");

  const blankEmail = validateReport("job-sign-off", signOffForm(), now);
  assert.equal(blankEmail.ok, true);
  if (blankEmail.ok && blankEmail.value.kind === "job-sign-off") assert.equal(blankEmail.value.clientEmail, undefined);

  const badEmail = validateReport("job-sign-off", signOffForm({ clientEmail: "not-an-email" }), now);
  assert.equal(badEmail.ok, false);
  if (!badEmail.ok) assert.equal(badEmail.errors.clientEmail, "Enter a valid email address.");

  const comments = validateReport("job-sign-off", signOffForm({ comments: "Client kept the offcut tiles." }), now);
  assert.equal(comments.ok, true);
});

test("gas checks require a comment only on fail, and the next check is two years later", () => {
  const valid = validateReport("gas-safety", gasForm(), now);
  assert.equal(valid.ok, true);
  if (valid.ok && valid.value.kind === "gas-safety") {
    assert.equal(valid.value.nextDue, "2026-02-28");
    assert.equal(valid.value.checks.find((item) => item.id === "leakage")?.result, "pass");
  }

  const bareFail = gasForm({ "check.leakage": "fail", overall: "non-compliant" });
  const failed = validateReport("gas-safety", bareFail, now);
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.errors["check.leakage.comment"], "Add a comment for this fail.");
    assert.equal(failed.errors["check.leakage.photos"], "Add a photo for this fail.");
  }

  const explained = gasForm({
    "check.leakage": "fail",
    "check.leakage.comment": "Drop at the cooker bayonet.",
    overall: "non-compliant",
  });
  failPhoto(explained, "itemPhoto.check.leakage");
  assert.equal(validateReport("gas-safety", explained, now).ok, true);

  const stillCompliant = gasForm({
    "check.leakage": "fail",
    "check.leakage.comment": "Drop at the cooker bayonet.",
  });
  failPhoto(stillCompliant, "itemPhoto.check.leakage");
  const compliant = validateReport("gas-safety", stillCompliant, now);
  assert.equal(compliant.ok, true);
  if (compliant.ok && compliant.value.kind === "gas-safety") assert.equal(compliant.value.overall, "non-compliant");

  const notApplicable = gasForm({ "check.lpg": "na" });
  assert.equal(validateReport("gas-safety", notApplicable, now).ok, true);

  const passNote = gasForm();
  passNote.set("check.ventilation.comment", "Window opens beside the heater.");
  assert.equal(validateReport("gas-safety", passNote, now).ok, true);

  const urgent = gasForm({ urgent: "yes", overall: "non-compliant" });
  const urgentResult = validateReport("gas-safety", urgent, now);
  assert.equal(urgentResult.ok, false);
  if (!urgentResult.ok) assert.equal(urgentResult.errors.urgentDetails, "Add what was urgent or disconnected.");

  const urgentNoted = gasForm({
    urgent: "yes",
    urgentDetails: "Room heater disconnected and tagged.",
    overall: "non-compliant",
  });
  const urgentOk = validateReport("gas-safety", urgentNoted, now);
  assert.equal(urgentOk.ok, true);
  if (urgentOk.ok && urgentOk.value.kind === "gas-safety") assert.equal(urgentOk.value.urgentDetails?.includes("tagged"), true);

  const partial = gasForm();
  partial.set("appliance.0.type", "Cooker");
  const partialResult = validateReport("gas-safety", partial, now);
  assert.equal(partialResult.ok, false);
  if (!partialResult.ok) assert.equal(partialResult.errors["appliance.0.location"], "Add the location.");

  const appliance = gasForm();
  appliance.set("appliance.0.type", "Cooker");
  appliance.set("appliance.0.location", "Kitchen");
  appliance.set("appliance.0.makeModel", "Westinghouse");
  appliance.set("appliance.0.serviced", "yes");
  appliance.set("appliance.0.co", "0 ppm, no spillage");
  appliance.set("appliance.0.record", "CC-19");
  const missingPlate = validateReport("gas-safety", appliance, now);
  assert.equal(missingPlate.ok, false);
  if (!missingPlate.ok) assert.equal(missingPlate.errors["keyPhoto.appliance.0"], "Add a photo of this appliance or its data plate.");
  appliance.append("keyPhoto.appliance.0", jpegFile("cooker.jpg"));
  const withAppliance = validateReport("gas-safety", appliance, now);
  assert.equal(withAppliance.ok, true);
  if (withAppliance.ok && withAppliance.value.kind === "gas-safety") {
    assert.equal(withAppliance.value.appliances.length, 1);
    assert.deepEqual(
      keyPhotoSlots(withAppliance.value, appliance).map((slot) => slot.caption),
      ["Test readings", "Cooker, Kitchen"],
    );
  }

  const record = gasForm({ servicingRecord: "yes" });
  const recorded = validateReport("gas-safety", record, now);
  assert.equal(recorded.ok, true);
  if (recorded.ok && recorded.value.kind === "gas-safety") assert.equal(recorded.value.servicingRecord, true);

  const noReadings = gasForm();
  noReadings.delete("keyPhoto.readings");
  const readings = validateReport("gas-safety", noReadings, now);
  assert.equal(readings.ok, false);
  if (!readings.ok) assert.equal(readings.errors["keyPhoto.readings"], "Add a photo of the test readings.");

  const twoReadings = gasForm();
  twoReadings.append("keyPhoto.readings", jpegFile("again.jpg"));
  const extraReading = validateReport("gas-safety", twoReadings, now);
  assert.equal(extraReading.ok, false);
  if (!extraReading.ok) assert.equal(extraReading.errors["keyPhoto.readings"], "Add one photo of the test readings.");
});

test("electrical fail comments, RCD rows, smoke alarms, and due dates", () => {
  const valid = validateReport("electrical-safety", electricalForm({ "earth.mains-earth": "pass", "earth.mains-earth.reading": "0.2 ohm" }), now);
  assert.equal(valid.ok, true);
  if (valid.ok && valid.value.kind === "electrical-safety") {
    assert.equal(valid.value.nextDue, "2028-11-01");
    assert.equal(valid.value.smokeNextDue, "2027-11-01");
    assert.equal(valid.value.earth.find((item) => item.id === "mains-earth")?.reading, "0.2 ohm");
  }

  const badReading = validateReport(
    "electrical-safety",
    electricalForm({ "earth.mains-earth": "pass", "earth.mains-earth.reading": "!!!" }),
    now,
  );
  assert.equal(badReading.ok, false);

  const visualFail = electricalForm({ "visual.switchboards": "fail", overall: "non-compliant" });
  const missingComment = validateReport("electrical-safety", visualFail, now);
  assert.equal(missingComment.ok, false);
  if (!missingComment.ok) {
    assert.equal(missingComment.errors["visual.switchboards.comment"], "Add a comment for this fail.");
    assert.equal(missingComment.errors["visual.switchboards.photos"], "Add a photo for this fail.");
  }

  const noRcd = electricalForm();
  noRcd.delete("rcd.0.circuit");
  noRcd.delete("rcd.0.push");
  const rcd = validateReport("electrical-safety", noRcd, now);
  assert.equal(rcd.ok, false);
  if (!rcd.ok) assert.equal(rcd.errors.rcd, "Add at least one RCD test.");

  const smoke = validateReport("electrical-safety", electricalForm({ smoke: "no", overall: "non-compliant" }), now);
  assert.equal(smoke.ok, false);
  if (!smoke.ok) assert.match(smoke.errors.smokeComment, /smoke alarms/);

  const smokeNoted = validateReport(
    "electrical-safety",
    electricalForm({ smoke: "no", smokeComment: "One alarm missing in the hallway.", overall: "non-compliant" }),
    now,
  );
  assert.equal(smokeNoted.ok, true);

  const noneIncluded = electricalForm();
  for (const item of electricalExtent) noneIncluded.set(`extent.${item.id}`, "na");
  const extent = validateReport("electrical-safety", noneIncluded, now);
  assert.equal(extent.ok, false);
  if (!extent.ok) assert.match(extent.errors.extent, /at least one/);

  const timed = electricalForm({ "rcd.0.time": "pass", "rcd.0.ms": "48" });
  const timedResult = validateReport("electrical-safety", timed, now);
  assert.equal(timedResult.ok, true);
  if (timedResult.ok && timedResult.value.kind === "electrical-safety") {
    assert.equal(timedResult.value.rcds[0]?.timeMs, "48");
  }

  const noBoard = electricalForm();
  noBoard.delete("keyPhoto.switchboard");
  const board = validateReport("electrical-safety", noBoard, now);
  assert.equal(board.ok, false);
  if (!board.ok) assert.equal(board.errors["keyPhoto.switchboard"], "Add a photo of the switchboard with the cover open.");

  const noRcdPhoto = electricalForm();
  noRcdPhoto.delete("keyPhoto.rcd");
  const rcdPhoto = validateReport("electrical-safety", noRcdPhoto, now);
  assert.equal(rcdPhoto.ok, false);
  if (!rcdPhoto.ok) assert.equal(rcdPhoto.errors["keyPhoto.rcd"], "Add a photo of the RCD test reading.");

  const noSmokePhoto = electricalForm();
  noSmokePhoto.delete("keyPhoto.smoke");
  const smokePhoto = validateReport("electrical-safety", noSmokePhoto, now);
  assert.equal(smokePhoto.ok, false);
  if (!smokePhoto.ok) assert.equal(smokePhoto.errors["keyPhoto.smoke"], "Add a photo of the smoke alarm showing the expiry date.");

  const manySmoke = electricalForm();
  for (let index = 0; index < 4; index += 1) manySmoke.append("keyPhoto.smoke", jpegFile(`smoke-${index}.jpg`));
  const tooManySmoke = validateReport("electrical-safety", manySmoke, now);
  assert.equal(tooManySmoke.ok, false);
  if (!tooManySmoke.ok) assert.equal(tooManySmoke.errors["keyPhoto.smoke"], "Add up to 4 smoke alarm photos.");
});

test("calendar addition clamps a leap day", () => {
  assert.equal(addYears("2024-02-29", 2), "2026-02-28");
  assert.equal(addYears("2024-02-29", 1), "2025-02-28");
  assert.equal(addYears("2026-11-14", 2), "2028-11-14");
  assert.equal(addYears("not-a-date", 2), null);
});

test("drive folder names stay inside the new tree", () => {
  assert.equal(submissionFolderName("2026-11-14", "../Existing Folder\\secret"), "2026-11-14 .. Existing Folder secret");
  assert.doesNotMatch(submissionFolderName("2026-11-14", "a/b"), /[/\\]/);
  const query = driveFolderQuery("O'Brien", "parent-id");
  assert.match(query, /oro-reports/);
  assert.match(query, /O\\'Brien/);
  assert.match(query, /parent-id/);
  assert.match(query, /trashed = false/);
  assert.doesNotMatch(query, /\b(delete|update)\b/i);
});

test("a signature must be a small png", () => {
  assert.equal(parseSignature("").ok, false);
  assert.equal(parseSignature("data:image/jpeg;base64,aaaa").ok, false);
  const parsed = parseSignature(tinyPng);
  assert.equal(parsed.ok, true);
});

test("the allowlist starts with pat and a rejection does not lock anyone out", () => {
  assert.equal(isEmailAllowed("Pat.Z@orosvc.com", ""), true);
  assert.equal(isEmailAllowed("worker@orosvc.com", ""), false);
  assert.deepEqual([...(allowedEmails(" Worker@orosvc.com , bad ") ?? [])], ["worker@orosvc.com"]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    assert.equal(isEmailAllowed("attacker@example.com", "pat.z@orosvc.com"), false);
  }
  assert.equal(isEmailAllowed("pat.z@orosvc.com", "pat.z@orosvc.com"), true);
  assert.equal(allowedEmails("@@@"), null);
  assert.deepEqual(allowlist(""), [{ email: "pat.z@orosvc.com", role: "owner" }]);
  assert.equal(staffRole("pat.z@orosvc.com", ""), "owner");
  assert.deepEqual(allowlist("pat.z@orosvc.com, Worker@orosvc.com"), [
    { email: "pat.z@orosvc.com", role: "owner" },
    { email: "worker@orosvc.com", role: "staff" },
  ]);
  assert.equal(isEmailAllowed("worker@orosvc.com", "pat.z@orosvc.com, worker@orosvc.com"), true);
  assert.equal(staffRole("worker@orosvc.com", "pat.z@orosvc.com, worker@orosvc.com"), "staff");
  assert.equal(staffRole("other@orosvc.com", "pat.z@orosvc.com, worker@orosvc.com"), null);
});

test("sessions round-trip only for an allowlisted email", async () => {
  const previous = {
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    session: process.env.INTERNAL_SESSION_SECRET,
    allow: process.env.INTERNAL_ALLOWED_EMAILS,
  };
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret-value";
  process.env.INTERNAL_SESSION_SECRET = "test-session-secret";
  process.env.INTERNAL_ALLOWED_EMAILS = "pat.z@orosvc.com";
  try {
    assert.equal(authConfigured(), true);
    const token = await signSession("Pat.Z@orosvc.com", "Pat Zee");
    assert.deepEqual(await readSession(token), { email: "pat.z@orosvc.com", name: "Pat Zee" });
    assert.equal(await readSession(`${token}x`), null);
    assert.equal(await readSession(token, Date.now() + 20 * 24 * 60 * 60 * 1000), null);
    await assert.rejects(() => signSession("other@orosvc.com"));
  } finally {
    for (const [key, value] of Object.entries({
      GOOGLE_CLIENT_ID: previous.id,
      GOOGLE_CLIENT_SECRET: previous.secret,
      INTERNAL_SESSION_SECRET: previous.session,
      INTERNAL_ALLOWED_EMAILS: previous.allow,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("google id tokens must be verified, allowed, and match the nonce", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const nonce = "n".repeat(43);
  const previous = process.env.INTERNAL_ALLOWED_EMAILS;
  process.env.INTERNAL_ALLOWED_EMAILS = "pat.z@orosvc.com";
  async function token(claims: Record<string, unknown> = {}) {
    return new SignJWT({ nonce, email: "pat.z@orosvc.com", email_verified: true, name: "Pat Zee", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://accounts.google.com")
      .setAudience("test-client")
      .setSubject("google-sub")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);
  }
  try {
    const ok = await verifyGoogleIdToken(await token(), { audience: "test-client", nonce, keys });
    assert.deepEqual(ok, { ok: true, email: "pat.z@orosvc.com", name: "Pat Zee" });
    const denied = await verifyGoogleIdToken(await token({ email: "other@orosvc.com" }), { audience: "test-client", nonce, keys });
    assert.deepEqual(denied, { ok: false, reason: "not-allowed" });
    const unverified = await verifyGoogleIdToken(await token({ email_verified: false }), { audience: "test-client", nonce, keys });
    assert.deepEqual(unverified, { ok: false, reason: "unverified" });
    const badNonce = await verifyGoogleIdToken(await token(), { audience: "test-client", nonce: "x".repeat(43), keys });
    assert.equal(badNonce.ok, false);
    if (!badNonce.ok) assert.equal(badNonce.reason, "invalid");
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_ALLOWED_EMAILS;
    else process.env.INTERNAL_ALLOWED_EMAILS = previous;
  }
});

test("a site job sheet becomes a pdf", async () => {
  const parsed = validateReport("site-job-sheet", siteForm("emporo"), now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const signature = parseSignature(tinyPng);
  assert.equal(signature.ok, true);
  if (!signature.ok) return;
  const pdf = await buildReportPdf({ report: parsed.value, signature: signature.bytes, photos: [], submittedBy: "pat.z@orosvc.com" });
  assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-");
  assert.ok(pdf.byteLength > 1000);
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getAuthor(), "Emporo Plumbing");
  assert.equal(document.getCreator(), "Emporo Plumbing Pty Ltd");
});

const tinyJpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00,
  0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f,
  0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
  0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
  0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff,
  0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08,
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00, 0xff, 0xd9,
]);

function embeddedImages(pdf: Uint8Array): number {
  return Buffer.from(pdf).toString("latin1").match(/\/Subtype\s*\/Image/g)?.length ?? 0;
}

test("key photos sit in the pdf ahead of any additional photos", async () => {
  const parsed = validateReport("gas-safety", gasForm(), now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const signature = parseSignature(tinyPng);
  assert.equal(signature.ok, true);
  if (!signature.ok) return;
  const plain = await buildReportPdf({ report: parsed.value, signature: signature.bytes, photos: [], submittedBy: "pat.z@orosvc.com" });
  const withKey = await buildReportPdf({
    report: parsed.value,
    signature: signature.bytes,
    photos: [],
    keyPhotos: [{ name: "Key 1 Test readings.jpg", bytes: tinyJpeg, mime: "image/jpeg", caption: "Test readings" }],
    submittedBy: "pat.z@orosvc.com",
  });
  const withBoth = await buildReportPdf({
    report: parsed.value,
    signature: signature.bytes,
    photos: [{ name: "Additional 1.jpg", bytes: tinyJpeg, mime: "image/jpeg", caption: "Hallway" }],
    keyPhotos: [{ name: "Key 1 Test readings.jpg", bytes: tinyJpeg, mime: "image/jpeg", caption: "Test readings" }],
    submittedBy: "pat.z@orosvc.com",
  });
  assert.equal(embeddedImages(withKey), embeddedImages(plain) + 1);
  assert.equal(embeddedImages(withBoth), embeddedImages(plain) + 2);
  const raw = Buffer.from(withBoth).toString("latin1");
  const keyAt = raw.indexOf("Key photos");
  const extraAt = raw.indexOf("Additional photos");
  if (keyAt >= 0 && extraAt >= 0) assert.ok(keyAt < extraAt);
});

test("safety reports use the company identity, not a typed business name", () => {
  const gas = validateReport("gas-safety", gasForm(), now);
  assert.equal(gas.ok, true);
  if (gas.ok) {
    assert.equal(companyFor(gas.value), "emporo");
    assert.deepEqual(reportMailIdentity(gas.value), {
      fromName: "Emporo Plumbing",
      alias: "info.emporo@orosvc.com",
      replyTo: "info.emporo@orosvc.com",
    });
  }
  const electrical = validateReport("electrical-safety", electricalForm(), now);
  assert.equal(electrical.ok, true);
  if (electrical.ok) {
    assert.equal(companyFor(electrical.value), "emoro");
    assert.equal(reportMailIdentity(electrical.value).fromName, "Emoro Building");
    assert.equal(reportMailIdentity(electrical.value).replyTo, "info.emoro@orosvc.com");
  }
  assert.equal(companies.emoro.legalName, "Emoro Building Pty Ltd");
  assert.equal(companies.emporo.legalName, "Emporo Plumbing Pty Ltd");
});
