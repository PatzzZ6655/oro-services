import { looksLikeImage, readText } from "@/lib/enquiry";
import { isRealCalendarDate } from "@/lib/appointments";
import {
  electricalEarth,
  electricalExtent,
  electricalPolarity,
  electricalVisual,
  gasChecks,
  isReportKind,
  itemPhotoField,
  itemPhotoMax,
  jobSafety,
  keyPhotoField,
  maxRepeatRows,
  smokePhotoMax,
  reportPhotoBytes,
  reportPhotoMax,
  reportPhotoTotalBytes,
  signOffConfirmations,
  type CheckAnswer,
  type CheckResult,
  type CompanyId,
  type ConfirmationAnswer,
  type ElectricalReport,
  type ExtentAnswer,
  type ExtentStatus,
  type FieldErrors,
  type GasAppliance,
  type GasReport,
  type JobSignOff,
  type NamedItem,
  type RcdRow,
  type ReportValue,
  type SafetyAnswer,
  type SiteJobSheet,
  type YesNo,
} from "@/lib/reports/catalog";
import { addYears, dateError } from "@/lib/reports/dates";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const readingPattern = /^[0-9A-Za-z.Ωµ/\s-]+$/;

export type Validation =
  | { ok: true; value: ReportValue }
  | { ok: false; errors: FieldErrors };

function oneLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function multiline(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function text(formData: FormData, key: string): string {
  return oneLine(readText(formData, key));
}

function block(formData: FormData, key: string): string {
  return multiline(readText(formData, key));
}

function requireLine(
  errors: FieldErrors,
  key: string,
  value: string,
  min: number,
  max: number,
  empty: string,
): boolean {
  if (value.length < min) {
    errors[key] = empty;
    return false;
  }
  if (value.length > max) {
    errors[key] = `Use ${max} characters or fewer.`;
    return false;
  }
  return true;
}

function optionalBlock(errors: FieldErrors, key: string, value: string, max: number): string | undefined {
  if (!value) return undefined;
  if (value.length > max) {
    errors[key] = `Use ${max} characters or fewer.`;
    return undefined;
  }
  return value;
}

function companyOf(value: string): CompanyId | null {
  return value === "emoro" || value === "emporo" ? value : null;
}

function yesNo(value: string): YesNo | null {
  return value === "yes" || value === "no" ? value : null;
}

function checkResult(value: string): CheckResult | null {
  return value === "pass" || value === "fail" || value === "na" ? value : null;
}

function readChecks(
  formData: FormData,
  errors: FieldErrors,
  group: string,
  items: readonly NamedItem[],
  withReading = false,
): CheckAnswer[] {
  const answers: CheckAnswer[] = [];
  for (const item of items) {
    const key = `${group}.${item.id}`;
    const result = checkResult(text(formData, key));
    const comment = block(formData, `${key}.comment`);
    const reading = withReading ? text(formData, `${key}.reading`) : "";
    if (!result) {
      errors[key] = "Choose a result.";
      continue;
    }
    if (result === "fail" && comment.length < 3) errors[`${key}.comment`] = "Add a comment for this fail.";
    if (comment.length > 500) errors[`${key}.comment`] = "Use 500 characters or fewer.";
    const photos = fileCount(formData, itemPhotoField(key));
    if (photos > itemPhotoMax) errors[`${key}.photos`] = "Use up to 4 photos.";
    if (result === "fail" && photos === 0) errors[`${key}.photos`] = "Add a photo for this fail.";
    if (reading.length > 24) errors[`${key}.reading`] = "Use a shorter reading.";
    else if (reading && !readingPattern.test(reading)) errors[`${key}.reading`] = "Use a short reading, such as 0.2 ohm.";
    if (!errors[key] && !errors[`${key}.comment`] && !errors[`${key}.reading`] && !errors[`${key}.photos`]) {
      answers.push({
        id: item.id,
        label: item.label,
        result,
        comment: result === "fail" || comment ? comment || undefined : undefined,
        reading: reading || undefined,
      });
    }
  }
  return answers;
}

function anyFail(checks: CheckAnswer[]): boolean {
  return checks.some((item) => item.result === "fail");
}

function readUrgent(formData: FormData, errors: FieldErrors): { urgent: YesNo; urgentDetails?: string } | null {
  const raw = text(formData, "urgent");
  const urgent = raw === "" ? "no" : yesNo(raw);
  const details = block(formData, "urgentDetails");
  if (!urgent) {
    errors.urgent = "Choose yes or no.";
    return null;
  }
  if (urgent === "yes") {
    if (details.length < 3) errors.urgentDetails = "Add what was urgent or disconnected.";
    else if (details.length > 1000) errors.urgentDetails = "Use 1000 characters or fewer.";
  } else if (details.length > 1000) {
    errors.urgentDetails = "Use 1000 characters or fewer.";
  }
  if (errors.urgent || errors.urgentDetails) return null;
  return { urgent, urgentDetails: urgent === "yes" ? details : undefined };
}

function readEmail(errors: FieldErrors, key: string, value: string, required: boolean): string | undefined {
  if (!value) {
    if (required) errors[key] = "Enter an email address.";
    return undefined;
  }
  if (!emailPattern.test(value) || value.length > 254) {
    errors[key] = "Enter a valid email address.";
    return undefined;
  }
  return value;
}

function readJobDate(formData: FormData, errors: FieldErrors, now: Date): string {
  const date = text(formData, "date");
  const problem = dateError(date, now);
  if (problem) errors.date = problem;
  return date;
}

function validateSiteJob(formData: FormData, errors: FieldErrors, now: Date): SiteJobSheet | null {
  const company = companyOf(text(formData, "company"));
  const workerName = text(formData, "workerName");
  const date = readJobDate(formData, errors, now);
  const jobNumber = text(formData, "jobNumber");
  const address = text(formData, "address");
  const startTime = text(formData, "startTime");
  const finishTime = text(formData, "finishTime");
  const work = block(formData, "work");
  const materials = optionalBlock(errors, "materials", block(formData, "materials"), 1000);
  const issues = optionalBlock(errors, "issues", block(formData, "issues"), 1000);

  if (!company) errors.company = "Choose Emoro Building or Emporo Plumbing.";
  requireLine(errors, "workerName", workerName, 2, 80, "Enter the worker's name.");
  requireLine(errors, "jobNumber", jobNumber, 1, 40, "Enter the job or invoice number.");
  requireLine(errors, "address", address, 5, 200, "Enter the site address.");
  if (!timePattern.test(startTime)) errors.startTime = "Enter a start time.";
  if (!timePattern.test(finishTime)) errors.finishTime = "Enter a finish time.";
  else if (timePattern.test(startTime) && finishTime.slice(0, 5) <= startTime.slice(0, 5)) {
    errors.finishTime = "Finish time is before the start time.";
  }
  requireLine(errors, "work", work, 3, 2000, "Add what work was done.");

  const safety: SafetyAnswer[] = [];
  if (company) {
    for (const item of jobSafety[company]) {
      const key = `safety.${company}.${item.id}`;
      const answer = yesNo(text(formData, key));
      if (!answer) errors[key] = "Choose yes or no.";
      else safety.push({ id: item.id, label: item.label, answer });
    }
  }

  if (Object.keys(errors).length > 0 || !company) return null;
  return {
    kind: "site-job-sheet",
    company,
    workerName,
    date,
    jobNumber,
    address,
    startTime,
    finishTime,
    work,
    materials,
    safety,
    issues,
  };
}

function validateSignOff(formData: FormData, errors: FieldErrors, now: Date): JobSignOff | null {
  const company = companyOf(text(formData, "company"));
  const jobNumber = text(formData, "jobNumber");
  const clientName = text(formData, "clientName");
  const address = text(formData, "address");
  const date = readJobDate(formData, errors, now);
  const work = block(formData, "work");
  const comments = optionalBlock(errors, "comments", block(formData, "comments"), 1000);
  const clientEmail = readEmail(errors, "clientEmail", text(formData, "clientEmail").toLowerCase(), false);

  if (!company) errors.company = "Choose Emoro Building or Emporo Plumbing.";
  requireLine(errors, "jobNumber", jobNumber, 1, 40, "Enter the job or invoice number.");
  requireLine(errors, "clientName", clientName, 2, 80, "Enter the client name.");
  requireLine(errors, "address", address, 5, 200, "Enter the site address.");
  requireLine(errors, "work", work, 3, 2000, "Add the work that was completed.");

  const confirmations: ConfirmationAnswer[] = [];
  for (const item of signOffConfirmations) {
    const key = `confirm.${item.id}`;
    if (text(formData, key) !== "yes") errors[key] = "This sign-off needs a yes.";
    else confirmations.push({ id: item.id, label: item.label, answer: "yes" });
  }

  let vbaRequired: YesNo | undefined;
  let vbaNumber: string | undefined;
  let vbaLodged: string | undefined;
  if (company === "emporo") {
    const answer = yesNo(text(formData, "vba"));
    if (!answer) errors.vba = "Choose yes or no.";
    else {
      vbaRequired = answer;
      if (answer === "yes") {
        const number = text(formData, "vbaNumber");
        const lodged = text(formData, "vbaLodged");
        if (!requireLine(errors, "vbaNumber", number, 2, 40, "Enter the certificate number.")) {
          // The number stays off the record until it is valid.
        } else vbaNumber = number;
        const lodgedProblem = dateError(lodged, now);
        if (lodgedProblem) errors.vbaLodged = "Enter the date it was lodged.";
        else vbaLodged = lodged;
      }
    }
  }

  if (Object.keys(errors).length > 0 || !company) return null;
  return {
    kind: "job-sign-off",
    company,
    jobNumber,
    clientName,
    address,
    date,
    work,
    confirmations,
    comments,
    clientEmail,
    vbaRequired,
    vbaNumber,
    vbaLodged,
  };
}

function readAppliances(formData: FormData, errors: FieldErrors): GasAppliance[] {
  const appliances: GasAppliance[] = [];
  for (let index = 0; index < maxRepeatRows; index += 1) {
    const prefix = `appliance.${index}`;
    const type = text(formData, `${prefix}.type`);
    const location = text(formData, `${prefix}.location`);
    const makeModel = text(formData, `${prefix}.makeModel`);
    const serviced = text(formData, `${prefix}.serviced`);
    const coSpillage = text(formData, `${prefix}.co`);
    const recordNo = text(formData, `${prefix}.record`);
    if ([type, location, makeModel, serviced, coSpillage, recordNo].every((value) => value === "")) continue;
    const servicedAnswer = yesNo(serviced);
    let rowOk = true;
    if (!requireLine(errors, `${prefix}.type`, type, 2, 60, "Add the appliance type.")) rowOk = false;
    if (!requireLine(errors, `${prefix}.location`, location, 2, 60, "Add the location.")) rowOk = false;
    if (!requireLine(errors, `${prefix}.makeModel`, makeModel, 2, 80, "Add the make and model.")) rowOk = false;
    if (!servicedAnswer) {
      errors[`${prefix}.serviced`] = "Say whether it was serviced to AS 4575.";
      rowOk = false;
    }
    if (!requireLine(errors, `${prefix}.co`, coSpillage, 2, 80, "Add the CO and spillage result.")) rowOk = false;
    if (recordNo.length > 40) {
      errors[`${prefix}.record`] = "Use 40 characters or fewer.";
      rowOk = false;
    }
    const photoField = keyPhotoField(`appliance.${index}`);
    const photos = fileCount(formData, photoField);
    if (photos === 0) {
      errors[photoField] = "Add a photo of this appliance or its data plate.";
      rowOk = false;
    } else if (photos > 1) {
      errors[photoField] = "Add one photo of this appliance.";
      rowOk = false;
    }
    if (rowOk && servicedAnswer) {
      appliances.push({
        type,
        location,
        makeModel,
        serviced: servicedAnswer,
        coSpillage,
        recordNo: recordNo || undefined,
      });
    }
  }
  return appliances;
}

function validateGas(formData: FormData, errors: FieldErrors, now: Date): GasReport | null {
  const address = text(formData, "address");
  const providerName = text(formData, "providerName");
  const providerEmail = readEmail(errors, "providerEmail", text(formData, "providerEmail").toLowerCase(), false);
  const date = readJobDate(formData, errors, now);
  const gasfitterName = text(formData, "gasfitterName");
  const licence = text(formData, "licence");
  const faults = optionalBlock(errors, "faults", block(formData, "faults"), 2000);
  requireLine(errors, "address", address, 5, 200, "Enter the property address.");
  requireLine(errors, "providerName", providerName, 2, 80, "Enter the rental provider or agent.");
  requireLine(errors, "gasfitterName", gasfitterName, 2, 80, "Enter the gasfitter's full name.");
  requireLine(errors, "licence", licence, 2, 40, "Enter the licence or registration number.");

  const checks = readChecks(formData, errors, "check", gasChecks);
  const appliances = readAppliances(formData, errors);
  requirePhotoCount(formData, errors, keyPhotoField("readings"), "Add a photo of the test readings.", 1, "Add one photo of the test readings.");
  const urgent = readUrgent(formData, errors);
  const nextDue = errors.date ? null : addYears(date, 2);
  if (!errors.date && !nextDue) errors.date = "Enter a date.";
  const overall = anyFail(checks) || urgent?.urgent === "yes" ? "non-compliant" : "compliant";

  if (Object.keys(errors).length > 0 || !urgent || !nextDue) return null;
  return {
    kind: "gas-safety",
    address,
    providerName,
    providerEmail,
    date,
    nextDue,
    gasfitterName,
    licence,
    servicingRecord: text(formData, "servicingRecord") === "yes",
    checks,
    appliances,
    faults,
    urgent: urgent.urgent,
    urgentDetails: urgent.urgentDetails,
    overall,
  };
}

function readExtent(formData: FormData, errors: FieldErrors): ExtentAnswer[] {
  const answers: ExtentAnswer[] = [];
  let included = 0;
  let missing = false;
  for (const item of electricalExtent) {
    const key = `extent.${item.id}`;
    const status = text(formData, key);
    if (status !== "included" && status !== "excluded" && status !== "na") {
      errors[key] = "Choose included, not included, or N/A.";
      missing = true;
      continue;
    }
    if (status === "included") included += 1;
    answers.push({ id: item.id, label: item.label, status: status as ExtentStatus });
  }
  if (!missing && included === 0) errors.extent = "Include at least one part of the installation.";
  return answers;
}

function readRcds(formData: FormData, errors: FieldErrors): RcdRow[] {
  const rows: RcdRow[] = [];
  for (let index = 0; index < maxRepeatRows; index += 1) {
    const prefix = `rcd.${index}`;
    const circuit = text(formData, `${prefix}.circuit`);
    const pushButton = text(formData, `${prefix}.push`);
    const timeRaw = text(formData, `${prefix}.time`);
    const timeTest = timeRaw === "skip" ? "" : timeRaw;
    const timeMs = text(formData, `${prefix}.ms`);
    if ([circuit, pushButton, timeTest, timeMs].every((value) => value === "")) continue;
    let rowOk = true;
    if (!requireLine(errors, `${prefix}.circuit`, circuit, 2, 60, "Name the circuit.")) rowOk = false;
    if (pushButton !== "pass" && pushButton !== "fail") {
      errors[`${prefix}.push`] = "Mark the push-button test.";
      rowOk = false;
    }
    let timeResult: "pass" | "fail" | undefined;
    if (timeTest) {
      if (timeTest !== "pass" && timeTest !== "fail") {
        errors[`${prefix}.time`] = "Mark the time test pass or fail.";
        rowOk = false;
      } else timeResult = timeTest;
    }
    if (timeMs && !/^\d{1,4}$/.test(timeMs)) {
      errors[`${prefix}.ms`] = "Enter the trip time in milliseconds, or leave it blank.";
      rowOk = false;
    }
    if (timeMs && !timeResult) {
      errors[`${prefix}.time`] = "Mark the time test.";
      rowOk = false;
    }
    if (rowOk && (pushButton === "pass" || pushButton === "fail")) {
      rows.push({
        circuit,
        pushButton,
        timeTest: timeResult,
        timeMs: timeMs || undefined,
      });
    }
  }
  if (rows.length === 0 && !Object.keys(errors).some((key) => key.startsWith("rcd."))) {
    errors.rcd = "Add at least one RCD test.";
  }
  return rows;
}

function validateElectrical(formData: FormData, errors: FieldErrors, now: Date): ElectricalReport | null {
  const address = text(formData, "address");
  const providerName = text(formData, "providerName");
  const providerEmail = readEmail(errors, "providerEmail", text(formData, "providerEmail").toLowerCase(), false);
  const date = readJobDate(formData, errors, now);
  const previousDate = text(formData, "previousDate");
  const electricianName = text(formData, "electricianName");
  const licence = text(formData, "licence");
  const rec = text(formData, "rec");
  const limitations = optionalBlock(errors, "limitations", block(formData, "limitations"), 500);
  const faults = optionalBlock(errors, "faults", block(formData, "faults"), 2000);
  const smoke = yesNo(text(formData, "smoke"));
  const smokeComment = block(formData, "smokeComment");

  requireLine(errors, "address", address, 5, 200, "Enter the property address.");
  requireLine(errors, "providerName", providerName, 2, 80, "Enter the rental provider or agent.");
  requireLine(errors, "electricianName", electricianName, 2, 80, "Enter the electrician's full name.");
  requireLine(errors, "licence", licence, 2, 40, "Enter the licence number.");
  if (rec && rec.length > 40) errors.rec = "Use 40 characters or fewer.";
  if (previousDate) {
    if (!isRealCalendarDate(previousDate) || previousDate < "1990-01-01") errors.previousDate = "Enter the previous check date, or leave it blank.";
    else if (!errors.date && previousDate > date) errors.previousDate = "The previous check is after this check.";
  }
  if (!smoke) errors.smoke = "Choose yes or no.";
  else if (smoke === "no" && smokeComment.length < 3) errors.smokeComment = "Add what is wrong with the smoke alarms.";
  if (smokeComment.length > 500) errors.smokeComment = "Use 500 characters or fewer.";

  const extent = readExtent(formData, errors);
  const visual = readChecks(formData, errors, "visual", electricalVisual);
  const polarity = readChecks(formData, errors, "polarity", electricalPolarity);
  const earth = readChecks(formData, errors, "earth", electricalEarth, true);
  const rcds = readRcds(formData, errors);
  requirePhotoCount(formData, errors, keyPhotoField("switchboard"), "Add a photo of the switchboard with the cover open.", 1, "Add one photo of the switchboard.");
  requirePhotoCount(formData, errors, keyPhotoField("rcd"), "Add a photo of the RCD test reading.", 1, "Add one photo of the RCD test reading.");
  requirePhotoCount(
    formData,
    errors,
    keyPhotoField("smoke"),
    "Add a photo of the smoke alarm showing the expiry date.",
    smokePhotoMax,
    "Add up to 4 smoke alarm photos.",
  );
  const urgent = readUrgent(formData, errors);
  const nextDue = errors.date ? null : addYears(date, 2);
  const smokeNextDue = errors.date ? null : addYears(date, 1);
  const rcdFail = rcds.some((row) => row.pushButton === "fail" || row.timeTest === "fail");
  const overall = anyFail(visual) || anyFail(polarity) || anyFail(earth) || rcdFail || smoke === "no" || urgent?.urgent === "yes" ? "non-compliant" : "compliant";

  if (Object.keys(errors).length > 0 || !smoke || !urgent || !nextDue || !smokeNextDue) {
    return null;
  }

  return {
    kind: "electrical-safety",
    address,
    providerName,
    providerEmail,
    date,
    previousDate: previousDate || undefined,
    nextDue,
    smokeNextDue,
    electricianName,
    licence,
    rec: rec || undefined,
    extent,
    limitations,
    visual,
    polarity,
    earth,
    rcds,
    smokeAlarms: smoke,
    smokeComment: smoke === "no" ? smokeComment : smokeComment || undefined,
    faults,
    urgent: urgent.urgent,
    urgentDetails: urgent.urgentDetails,
    overall,
  };
}

export function validateReport(kind: string, formData: FormData, now = new Date()): Validation {
  if (!isReportKind(kind)) return { ok: false, errors: { kind: "Choose a report." } };
  const errors: FieldErrors = {};
  const value =
    kind === "site-job-sheet"
      ? validateSiteJob(formData, errors, now)
      : kind === "job-sign-off"
        ? validateSignOff(formData, errors, now)
        : kind === "gas-safety"
          ? validateGas(formData, errors, now)
          : validateElectrical(formData, errors, now);
  if (!value || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

export function parseSignature(value: string): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.trim());
  if (!match) return { ok: false, error: "Add a signature." };
  if (match[1].length > 180_000) return { ok: false, error: "The signature is too large. Clear it and sign again." };
  let bytes: Uint8Array;
  try {
    const binary = atob(match[1]);
    bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  } catch {
    return { ok: false, error: "Add a signature." };
  }
  if (!looksLikeImage(bytes, "image/png") || bytes.length < 40) return { ok: false, error: "Add a signature." };
  return { ok: true, bytes };
}

function fileCount(formData: FormData, key: string): number {
  return formData.getAll(key).filter((item) => item instanceof File && item.size > 0).length;
}

function requirePhotoCount(formData: FormData, errors: FieldErrors, field: string, missing: string, max: number, tooMany: string) {
  const count = fileCount(formData, field);
  if (count === 0) errors[field] = missing;
  else if (count > max) errors[field] = tooMany;
}

export type KeyPhotoSlot = { field: string; caption: string; max: number };

export function keyPhotoSlots(report: ReportValue, formData: FormData): KeyPhotoSlot[] {
  if (report.kind === "gas-safety") {
    const slots: KeyPhotoSlot[] = [{ field: "readings", caption: "Test readings", max: 1 }];
    let seen = 0;
    for (let index = 0; index < maxRepeatRows; index += 1) {
      const filled = ["type", "location", "makeModel", "serviced", "co", "record"].map((part) => text(formData, `appliance.${index}.${part}`));
      if (filled.every((value) => value === "")) continue;
      const appliance = report.appliances[seen];
      seen += 1;
      if (!appliance) continue;
      slots.push({ field: `appliance.${index}`, caption: `${appliance.type}, ${appliance.location}`, max: 1 });
    }
    return slots;
  }
  if (report.kind === "electrical-safety") {
    return [
      { field: "switchboard", caption: "Switchboard, cover open", max: 1 },
      { field: "rcd", caption: "RCD test reading", max: 1 },
      { field: "smoke", caption: "Smoke alarm", max: smokePhotoMax },
    ];
  }
  return [];
}

export function validatePhotoBudget(files: { size: number; type: string }[]): string | null {
  let total = 0;
  for (const file of files) {
    total += file.size;
    if (file.size > reportPhotoBytes) return "Each photo must be 1 MB or smaller.";
    if (file.type !== "image/jpeg" && file.type !== "image/png") return "Use a JPEG or PNG photo.";
  }
  if (total > reportPhotoTotalBytes) return "Photos are too large together. Use fewer photos.";
  return null;
}

export function validatePhotoFiles(files: { size: number; type: string }[]): string | null {
  if (files.length > reportPhotoMax) return "Add up to 8 photos.";
  let total = 0;
  for (const file of files) {
    total += file.size;
    if (file.size > reportPhotoBytes) return "Each photo must be 1 MB or smaller.";
    if (file.type !== "image/jpeg" && file.type !== "image/png") return "Use a JPEG or PNG photo.";
  }
  if (total > reportPhotoTotalBytes) return "Photos are too large together. Use fewer photos.";
  return null;
}

export function reportAddress(report: ReportValue): string {
  return report.address;
}

export function reportDate(report: ReportValue): string {
  return report.date;
}
