import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { PDFDocument } from "pdf-lib";
import { internalLoginHref, stockDashboardHref } from "@/lib/content";
import {
  allowedEmails,
  authConfigured,
  isEmailAllowed,
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
import { parseSignature, validateReport } from "@/lib/reports/validate";

const now = new Date("2026-11-14T03:00:00.000Z");
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
    "confirm.completed": "yes",
    "confirm.tidy": "yes",
    "confirm.walkthrough": "yes",
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
    endorsement: "yes",
    urgent: "no",
    overall: "compliant",
    ...extra,
  };
  for (const item of gasChecks) fields[`check.${item.id}`] = fields[`check.${item.id}`] ?? "pass";
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
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
  return data;
}

test("the footer target is the on-site portal and the stock dashboard stays external", () => {
  assert.equal(internalLoginHref, "/internal");
  assert.equal(stockDashboardHref, "https://tape.orosvc.com");
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

test("sign-off needs all three yes answers and treats client email as optional", () => {
  assert.equal(validateReport("job-sign-off", signOffForm(), now).ok, true);
  const refused = validateReport("job-sign-off", signOffForm({ "confirm.tidy": "no" }), now);
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.errors["confirm.tidy"], "This sign-off needs a yes.");

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
  if (!failed.ok) assert.equal(failed.errors["check.leakage.comment"], "Add a comment for this fail.");

  const explained = gasForm({
    "check.leakage": "fail",
    "check.leakage.comment": "Drop at the cooker bayonet.",
    overall: "non-compliant",
  });
  assert.equal(validateReport("gas-safety", explained, now).ok, true);

  const stillCompliant = gasForm({
    "check.leakage": "fail",
    "check.leakage.comment": "Drop at the cooker bayonet.",
    overall: "compliant",
  });
  const compliant = validateReport("gas-safety", stillCompliant, now);
  assert.equal(compliant.ok, false);
  if (!compliant.ok) assert.match(compliant.errors.overall, /non-compliant/);

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
  const withAppliance = validateReport("gas-safety", appliance, now);
  assert.equal(withAppliance.ok, true);
  if (withAppliance.ok && withAppliance.value.kind === "gas-safety") assert.equal(withAppliance.value.appliances.length, 1);

  const noEndorsement = gasForm();
  noEndorsement.delete("endorsement");
  const endorsement = validateReport("gas-safety", noEndorsement, now);
  assert.equal(endorsement.ok, false);
  if (!endorsement.ok) assert.match(endorsement.errors.endorsement, /Type A/);
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
  if (!missingComment.ok) assert.equal(missingComment.errors["visual.switchboards.comment"], "Add a comment for this fail.");

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
