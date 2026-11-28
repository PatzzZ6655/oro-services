import { introCcPayload } from "@/lib/jobs-app/intro-email";
import { normalisePropertyAddress } from "@/lib/jobs-app/job-place";
import { jobPropertyAddress } from "@/lib/jobs-app/property-address";
import {
  newJobNeedDetail,
  newJobTextCoversScreenshots,
  newJobTextPayload,
  parseTenantList,
  readNewJobText,
  readTenantsField,
  screenshotReadFallback,
  tenantPayload,
  type JobTenant,
} from "@/lib/jobs-app/new-job-text";
import { normalizePhone } from "@/lib/jobs-app/phones";
import { LEAVE_MAX_PHOTOS, NEW_JOB_MAX_IMAGES, UPLOAD_BUDGET_BYTES } from "@/lib/jobs-app/photos";
import { existingInvoiceMessage, isAmountLayout, isInvoiceType, isNotesMode, isQaChoice, type AmountLayout, type InvoiceTask, type InvoiceType, type NotesMode, type QaChoice } from "@/lib/jobs-app/invoice";
import { applyVoucherStatus, cleanVoucherCode, notionPageId, voucherStatus } from "@/lib/jobs-app/voucher";
import {
  isBusiness,
  type ApplyVoucherResult,
  type Business,
  type Contact,
  type DepartResult,
  type JobsError,
  type JobsResult,
  type LeaveResult,
  type NewJobResult,
  type TodayJob,
} from "@/lib/jobs-app/types";

const JSON_TIMEOUT_MS = 25_000;
const FILE_TIMEOUT_MS = 55_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp"]);

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type BinaryFile = { name: string; type: string; bytes: Uint8Array };

function trimmedEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function httpUrl(name: string): string | null {
  const value = trimmedEnv(name);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function makeConfig(): { secret: string; today: string; depart: string; leave: string; newJob: string } | null {
  const secret = trimmedEnv("MAKE_SHORTCUTS_SECRET");
  const today = httpUrl("MAKE_JOBS_TODAY_URL");
  const depart = httpUrl("MAKE_DEPART_URL");
  const leave = httpUrl("MAKE_LEAVE_URL");
  const newJob = httpUrl("MAKE_NEWJOB_URL");
  if (!secret || !today || !depart || !leave || !newJob) return null;
  return { secret, today, depart, leave, newJob };
}

function unconfigured(): JobsResult<never> {
  return { status: 503, body: { ok: false, error: "unconfigured", message: "The server is not set up yet." } };
}

function upstream(): JobsResult<never> {
  return { status: 502, body: { ok: false, error: "upstream", message: "The server did not reply. Try again." } };
}

function statusFor(error: JobsError, upstreamStatus: number): number {
  if (error.error === "no_open_visit") return 409;
  if (error.error === "no_address" || error.error === "need_business") return 422;
  if (error.error === "webhook_unauthorized" || error.error === "upstream") return 502;
  if (upstreamStatus >= 400 && upstreamStatus !== 401) return upstreamStatus;
  return 502;
}

function text(value: unknown, max: number, secret: string): string {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value : "";
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  const redacted = secret.length >= 8 ? cleaned.split(secret).join("") : cleaned;
  return redacted.slice(0, max);
}

function httpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function flag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function cleanJobId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 120) return null;
  if (/[\s/\\]/.test(trimmed) || /[\u0000-\u001F]/.test(trimmed)) return null;
  return trimmed;
}

function failure(status: number, json: Record<string, unknown> | null): JobsError | null {
  const raw = json && typeof json.error === "string" ? json.error.trim() : "";
  const failed = status >= 400 || (json?.ok === false) || raw.length > 0;
  if (!failed && json) return null;
  if (status === 409 || /no open visit/i.test(raw)) {
    return { ok: false, error: "no_open_visit", message: "No open visit for this job. Tap Depart first." };
  }
  if (status === 401 || raw === "unauthorized") {
    return { ok: false, error: "webhook_unauthorized", message: "The server key was rejected." };
  }
  if (raw === "noAddress") return { ok: false, error: "no_address", message: "No address was read. Try a clearer screenshot." };
  if (raw === "needBusiness") return { ok: false, error: "need_business", message: "Could not tell Emoro from Emporo. Choose one and try again." };
  return { ok: false, error: "upstream", message: "The server did not reply. Try again." };
}

function phoneList(value: unknown, secret: string): string[] {
  const raw = text(value, 500, secret);
  const phones: string[] = [];
  for (const part of raw.split(",")) {
    const phone = normalizePhone(part);
    if (phone && !phones.includes(phone)) phones.push(phone);
  }
  return phones;
}

function contactsOf(json: Record<string, unknown>, secret: string, fallbackSms: string): Contact[] {
  const parsed: Contact[] = [];
  if (Array.isArray(json.contacts)) {
    for (const item of json.contacts) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const phone = normalizePhone(text(row.phone, 40, secret));
      if (!phone) continue;
      parsed.push({
        name: text(row.name, 80, secret),
        phone,
        sms: text(row.sms, 2000, secret) || fallbackSms,
      });
      if (parsed.length >= 12) break;
    }
  }
  const tenant = text(json.tenant, 80, secret);
  if (parsed.length === 1 && !parsed[0]?.name && tenant) parsed[0] = { ...parsed[0], name: tenant };
  if (parsed.length > 0) return parsed;

  const phones = [
    ...phoneList(json.phones, secret),
    ...(["phone1", "phone2", "phone3"] as const)
      .map((key) => normalizePhone(text(json[key], 40, secret)))
      .filter((phone): phone is string => Boolean(phone)),
  ];
  const unique = [...new Set(phones)].slice(0, 12);
  return unique.map((phone, index) => ({ name: index === 0 ? tenant : "", phone, sms: fallbackSms }));
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  if (response.status >= 300 && response.status < 400) return null;
  const raw = await response.text();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function postJson(url: string, payload: Record<string, unknown>, call: FetchLike, timeout: number): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const response = await call(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
  });
  const json = await readJson(response);
  if (response.status >= 300 && response.status < 400) return { status: 502, json: null };
  return { status: response.status, json };
}

function jobFrom(value: unknown, fallback: Business, secret: string): TodayJob | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const jobId = cleanJobId(text(row.jobId, 120, secret));
  const business = isBusiness(row.business) ? row.business : fallback;
  const title = text(row.title, 200, secret);
  if (!jobId || !title) return null;
  return {
    business,
    jobId,
    title,
    address: text(row.address, 300, secret),
    status: text(row.status, 80, secret),
    scheduled: text(row.scheduled, 80, secret),
  };
}

export async function listToday(fetchImpl?: FetchLike): Promise<JobsResult<{ ok: true; date: string; jobs: TodayJob[] }>> {
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const [emoro, emporo] = await Promise.all(
      (["emoro", "emporo"] as const).map((business) =>
        postJson(config.today, { secret: config.secret, business }, call, JSON_TIMEOUT_MS),
      ),
    );
    const bodies = [
      { business: "emoro" as const, result: emoro },
      { business: "emporo" as const, result: emporo },
    ];
    for (const item of bodies) {
      const error = failure(item.result.status, item.result.json);
      if (error) return { status: statusFor(error, item.result.status), body: error };
      if (!item.result.json || !Array.isArray(item.result.json.jobs)) return upstream();
    }
    const jobs: TodayJob[] = [];
    const seen = new Set<string>();
    let date = "";
    for (const item of bodies) {
      const json = item.result.json;
      if (!json || !Array.isArray(json.jobs)) continue;
      if (!date) date = text(json.date, 40, config.secret);
      for (const job of json.jobs) {
        const parsed = jobFrom(job, item.business, config.secret);
        if (!parsed) continue;
        const key = `${parsed.business}:${parsed.jobId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push(parsed);
      }
    }
    return { status: 200, body: { ok: true, date, jobs } };
  } catch {
    return upstream();
  }
}

function visitFields(json: Record<string, unknown>, secret: string, business: Business) {
  const sms = text(json.sms, 2000, secret);
  return {
    business: isBusiness(json.business) ? json.business : business,
    brand: text(json.brand, 80, secret),
    visit: text(json.visit, 20, secret),
    jobTitle: text(json.jobTitle, 200, secret),
    address: text(json.address, 300, secret),
    tenant: text(json.tenant, 80, secret),
    contacts: contactsOf(json, secret, sms),
    sms,
  };
}

export async function departJob(business: Business, jobId: string, fetchImpl?: FetchLike): Promise<JobsResult<DepartResult>> {
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const result = await postJson(config.depart, { secret: config.secret, business, jobId }, call, JSON_TIMEOUT_MS);
    const error = failure(result.status, result.json);
    if (error || !result.json) {
      const body = error ?? upstream().body;
      return { status: statusFor(body, result.status), body };
    }
    return {
      status: 200,
      body: {
        ok: true,
        ...visitFields(result.json, config.secret, business),
        departedAt: text(result.json.departedAt, 80, config.secret),
        jobStatus: text(result.json.jobStatus, 80, config.secret),
      },
    };
  } catch {
    return upstream();
  }
}

export async function readUpload(form: FormData, field: string, maxCount: number): Promise<{ ok: true; files: BinaryFile[] } | { ok: false; status: number; body: JobsError }> {
  const files: BinaryFile[] = [];
  let total = 0;
  for (const item of form.getAll(field)) {
    if (!(item instanceof File) || item.size <= 0) continue;
    if (!IMAGE_TYPES.has(item.type)) {
      return { ok: false, status: 400, body: { ok: false, error: "bad_request", message: "Choose a JPEG photo." } };
    }
    if (files.length >= maxCount) {
      const message = field === "images" ? "At most 4 screenshots." : "Too many photos. Choose fewer.";
      return { ok: false, status: 400, body: { ok: false, error: "bad_request", message } };
    }
    total += item.size;
    if (item.size > UPLOAD_BUDGET_BYTES || total > UPLOAD_BUDGET_BYTES) {
      return { ok: false, status: 413, body: { ok: false, error: "too_large", message: "The photos are too large. Choose fewer." } };
    }
    files.push({
      name: `photo-${files.length + 1}.jpg`,
      type: item.type === "image/png" || item.type === "image/webp" ? item.type : "image/jpeg",
      bytes: new Uint8Array(await item.arrayBuffer()),
    });
  }
  return { ok: true, files };
}

function blobBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function formBody(fields: Record<string, string>, files: BinaryFile[], fileField: string): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  for (const file of files) form.append(fileField, new Blob([blobBytes(file.bytes)], { type: file.type }), file.name);
  return form;
}

async function postForm(url: string, form: FormData, call: FetchLike): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const response = await call(url, {
    method: "POST",
    body: form,
    headers: { accept: "application/json" },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
  });
  const json = await readJson(response);
  if (response.status >= 300 && response.status < 400) return { status: 502, json: null };
  return { status: response.status, json };
}

function fieldText(value: FormDataEntryValue | null, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export async function leaveJob(form: FormData, fetchImpl?: FetchLike): Promise<JobsResult<LeaveResult>> {
  const business = form.get("business");
  const jobId = cleanJobId(form.get("jobId"));
  const outcome = form.get("outcome");
  if (!isBusiness(business) || !jobId || (outcome !== "return" && outcome !== "complete")) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "That request was not valid." } };
  }
  const photos = await readUpload(form, "photos", LEAVE_MAX_PHOTOS);
  if (!photos.ok) return photos;
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const result = await postForm(
      config.leave,
      formBody(
        {
          secret: config.secret,
          business,
          jobId,
          outcome,
          notes: fieldText(form.get("notes"), 4000),
          checklist: fieldText(form.get("checklist"), 4000),
          issues: fieldText(form.get("issues"), 4000),
          includeVoucher: outcome === "complete" && form.get("includeVoucher") === "1" ? "1" : "0",
        },
        photos.files,
        "photos",
      ),
      call,
    );
    const error = failure(result.status, result.json);
    if (error || !result.json) {
      const body = error ?? upstream().body;
      return { status: statusFor(body, result.status), body };
    }
    const fields = visitFields(result.json, config.secret, business);
    return {
      status: 200,
      body: {
        ok: true,
        ...fields,
        outcome,
        driveLink: httpsUrl(result.json.driveLink),
        checklist: text(result.json.checklist, 4000, config.secret),
        issues: text(result.json.issues, 4000, config.secret),
        summary: text(result.json.summary, 4000, config.secret),
        reviewLinkConfigured: flag(result.json.reviewLinkConfigured) ?? false,
        pmEmailedTo: text(result.json.pmEmailedTo, 200, config.secret),
        voucherCode: text(result.json.voucherCode, 80, config.secret),
        voucherExpiry: text(result.json.voucherExpiry, 80, config.secret),
        leftAt: text(result.json.leftAt, 80, config.secret),
      },
    };
  } catch {
    return upstream();
  }
}

export type ScreenshotRead = {
  ok: true;
  mode: string;
  business: string;
  businessGuess: string;
  tenantName: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  workOrderNumber: string;
  voucher: string;
  tenant2Name: string;
  phone2: string;
  email2: string;
  pmName: string;
  pmAgency: string;
  pmEmail: string;
  pmPhone: string;
  tenants: JobTenant[];
  officeHint: string;
};

function readValue(json: Record<string, unknown>, key: string, max: number, secret: string): string {
  return text(json[key], max, secret);
}

function businessGuess(value: string): string {
  return value === "emoro" || value === "emporo" || value === "unclear" ? value : "";
}

export async function readScreenshots(form: FormData, fetchImpl?: FetchLike): Promise<JobsResult<ScreenshotRead>> {
  const businessRaw = form.get("business");
  const business = isBusiness(businessRaw) ? businessRaw : "";
  const images = await readUpload(form, "images", NEW_JOB_MAX_IMAGES);
  if (!images.ok) return images;
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const voucher = cleanVoucherCode(fieldText(form.get("voucher"), 40));
    const fields: Record<string, string> = { secret: config.secret, mode: "readScreenshots" };
    if (business) fields.business = business;
    if (voucher) fields.voucher = voucher;
    const result = await postForm(config.newJob, formBody(fields, images.files, "images"), call);
    if (result.status === 401 || result.json?.error === "unauthorized") {
      const error = failure(401, result.json) ?? {
        ok: false as const,
        error: "webhook_unauthorized",
        message: "The server key was rejected.",
      };
      return { status: statusFor(error, result.status), body: error };
    }
    const accepted = result.status === 200 && (result.json?.ok === true || result.json?.ok === "true");
    if (!accepted || !result.json) {
      return { status: 502, body: { ok: false, error: "unreadable", message: screenshotReadFallback } };
    }
    const secret = config.secret;
    const guess = businessGuess(readValue(result.json, "businessGuess", 20, secret));
    const agency = readValue(result.json, "pmAgency", 80, secret);
    const rawAddress = readValue(result.json, "address", 300, secret);
    const address = normalisePropertyAddress(jobPropertyAddress(rawAddress, { agency }));
    return {
      status: 200,
      body: {
        ok: true,
        mode: readValue(result.json, "mode", 40, secret),
        business: readValue(result.json, "business", 20, secret),
        businessGuess: guess,
        tenantName: readValue(result.json, "tenantName", 80, secret),
        phone: readValue(result.json, "phone", 40, secret),
        email: readValue(result.json, "email", 120, secret),
        address,
        description: readValue(result.json, "description", 2000, secret),
        workOrderNumber: readValue(result.json, "workOrderNumber", 80, secret),
        voucher: readValue(result.json, "voucher", 40, secret),
        tenant2Name: readValue(result.json, "tenant2Name", 80, secret),
        phone2: readValue(result.json, "phone2", 40, secret),
        email2: readValue(result.json, "email2", 120, secret),
        pmName: readValue(result.json, "pmName", 80, secret),
        pmAgency: agency,
        pmEmail: readValue(result.json, "pmEmail", 120, secret),
        pmPhone: readValue(result.json, "pmPhone", 40, secret),
        tenants: parseTenantList(result.json.tenants).map((row) => ({
          name: text(row.name, 80, secret),
          phone: text(row.phone, 40, secret),
          email: text(row.email, 120, secret),
        })),
        officeHint: address ? "" : rawAddress,
      },
    };
  } catch {
    return { status: 502, body: { ok: false, error: "unreadable", message: screenshotReadFallback } };
  }
}

export async function createJob(form: FormData, fetchImpl?: FetchLike): Promise<JobsResult<NewJobResult>> {
  const business = form.get("business");
  if (!isBusiness(business)) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Choose Emoro or Emporo." } };
  }
  const images = await readUpload(form, "images", NEW_JOB_MAX_IMAGES);
  if (!images.ok) return images;
  const typed = readNewJobText(form);
  const listed = typeof form.get("tenants") === "string";
  const tenants = listed ? readTenantsField(form.get("tenants")) : [];
  const named = tenants.find((row) => row.name)?.name ?? "";
  if (images.files.length === 0 && !newJobTextCoversScreenshots({ ...typed, tenantName: typed.tenantName || named })) {
    return { status: 400, body: { ok: false, error: "bad_request", message: newJobNeedDetail } };
  }
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const voucher = cleanVoucherCode(fieldText(form.get("voucher"), 40));
    const details = newJobTextPayload(typed);
    if (listed) {
      delete details.tenantName;
      delete details.phone;
      Object.assign(details, tenantPayload(tenants));
    }
    if (details.address) details.address = normalisePropertyAddress(details.address);
    const jobTitle = fieldText(form.get("jobTitle"), 300);
    const fields: Record<string, string> = { secret: config.secret, business, ...details };
    if (jobTitle) fields.jobTitle = jobTitle;
    if (voucher) fields.voucher = voucher;
    const result = await postForm(config.newJob, formBody(fields, images.files, "images"), call);
    const error = failure(result.status, result.json);
    if (error || !result.json) {
      const body = error ?? upstream().body;
      return { status: statusFor(body, result.status), body };
    }
    const jobUrl = httpsUrl(result.json.jobUrl);
    if (!jobUrl) return upstream();
    const secret = config.secret;
    return {
      status: 200,
      body: {
        ok: true,
        jobUrl,
        jobId: text(result.json.jobId, 40, secret).replace(/-/g, "") || notionPageId(jobUrl) || "",
        jobTitle: text(result.json.jobTitle, 200, secret),
        brand: text(result.json.brand, 80, secret),
        address: text(result.json.address, 300, secret),
        desc: text(result.json.desc, 4000, secret) || text(result.json.description, 4000, secret),
        tenant1: text(result.json.tenant1, 80, secret),
        phone1: text(result.json.phone1, 40, secret),
        email1: text(result.json.email1, 120, secret),
        tenant2: text(result.json.tenant2, 80, secret),
        phone2: text(result.json.phone2, 40, secret),
        pmName: text(result.json.pmName, 80, secret),
        pmAgency: text(result.json.pmAgency, 80, secret),
        pmEmail: text(result.json.pmEmail, 120, secret),
        pmPhone: text(result.json.pmPhone, 40, secret),
        workOrderNumber: text(result.json.workOrderNumber, 80, secret),
        description: text(result.json.description, 2000, secret),
        tenants: parseTenantList(result.json.tenants).map((row) => ({
          name: text(row.name, 80, secret),
          phone: text(row.phone, 40, secret),
          email: text(row.email, 120, secret),
        })),
        propertyCreated: flag(result.json.propertyCreated),
        customerCreated: flag(result.json.customerCreated),
        contact1Created: flag(result.json.contact1Created),
        voucherStatus: voucherStatus(result.json.voucherStatus),
        voucherCode: text(result.json.voucherCode, 40, secret),
        voucherValue: text(result.json.voucherValue, 20, secret),
        voucherMessage: text(result.json.voucherMessage, 300, secret),
        voucherBusiness: text(result.json.voucherBusiness, 40, secret),
        voucherRedeemedDate: text(result.json.voucherRedeemedDate, 10, secret),
      },
    };
  } catch {
    return upstream();
  }
}

export type IntroEmailOutcome = {
  ok: true;
  mode: "sendIntroEmail";
  status: string;
  message: string;
  sendAt: string;
  to: string;
  error: string;
};

export async function sendIntroEmail(
  input: {
    jobId: string;
    business: Business;
    desc: string;
    address: string;
    pmAgency: string;
    tenants: { name: string; email: string }[];
    action: "send" | "skip";
    ccPm?: boolean;
    pmEmail?: string;
  },
  fetchImpl?: FetchLike,
): Promise<JobsResult<IntroEmailOutcome>> {
  if (input.action !== "send" && input.action !== "skip") {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Choose send or skip." } };
  }
  if (!isBusiness(input.business)) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Choose Emoro or Emporo." } };
  }
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  const tenants = input.tenants
    .map((row) => ({ name: row.name.replace(/[\u0000-\u001F]+/g, " ").trim().slice(0, 80), email: row.email.replace(/[\u0000-\u001F]+/g, " ").trim().slice(0, 120) }))
    .filter((row) => row.name || row.email);
  const cc = introCcPayload(input.ccPm === true, input.pmEmail ?? "");
  try {
    const result = await postJson(
      config.newJob,
      {
        secret: config.secret,
        mode: "sendIntroEmail",
        jobId: input.jobId.replace(/-/g, ""),
        business: input.business,
        desc: input.desc,
        address: input.address,
        pmAgency: input.pmAgency.trim(),
        tenants,
        action: input.action,
        ccPm: cc.ccPm,
        pmEmail: cc.pmEmail,
      },
      call,
      JSON_TIMEOUT_MS,
    );
    if (result.status === 401 || result.json?.error === "unauthorized") {
      const error = failure(401, result.json) ?? {
        ok: false as const,
        error: "webhook_unauthorized",
        message: "The server key was rejected.",
      };
      return { status: statusFor(error, result.status), body: error };
    }
    const secret = config.secret;
    const errorCode = text(result.json?.error, 40, secret);
    if (result.status === 400 || errorCode === "missingDescOrJobId") {
      return {
        status: 400,
        body: {
          ok: false,
          error: "missingDescOrJobId",
          message: text(result.json?.message, 300, secret) || "The job text or job id is missing.",
        },
      };
    }
    if (result.status === 404 || errorCode === "jobNotFound") {
      return {
        status: 404,
        body: { ok: false, error: "jobNotFound", message: text(result.json?.message, 300, secret) || "That job was not found." },
      };
    }
    if (result.status === 502 || errorCode === "sendFailed" || errorCode === "noneSent" || result.json?.status === "failed") {
      return {
        status: 502,
        body: {
          ok: false,
          error: errorCode || "sendFailed",
          message: text(result.json?.message, 300, secret) || "The intro email was not sent.",
        },
      };
    }
    if (!result.json || result.json.ok === false) return upstream();
    return {
      status: 200,
      body: {
        ok: true,
        mode: "sendIntroEmail",
        status: text(result.json.status, 40, secret),
        message: text(result.json.message, 400, secret),
        sendAt: text(result.json.sendAt, 80, secret),
        to: text(result.json.to, 120, secret),
        error: "",
      },
    };
  } catch {
    return upstream();
  }
}

function voucherAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

export async function applyVoucher(
  jobRef: string,
  code: string,
  business: Business,
  fetchImpl?: FetchLike,
): Promise<JobsResult<ApplyVoucherResult>> {
  const config = makeConfig();
  if (!config) return unconfigured();
  const jobId = notionPageId(jobRef);
  if (!jobId) {
    return { status: 400, body: { ok: false, error: "bad_job", message: "Paste a Notion job link or pick a job." } };
  }
  const voucher = cleanVoucherCode(code);
  if (!voucher) {
    return { status: 400, body: { ok: false, error: "bad_code", message: "Enter a voucher code." } };
  }
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const result = await postJson(
      config.newJob,
      { secret: config.secret, business, mode: "applyVoucher", jobId, voucher },
      call,
      JSON_TIMEOUT_MS,
    );
    if (result.status === 401 || result.json?.error === "unauthorized") {
      const error = failure(401, result.json) ?? { ok: false as const, error: "webhook_unauthorized", message: "The server key was rejected." };
      return { status: statusFor(error, result.status), body: error };
    }
    if (result.status === 502 || result.json?.error === "voucherUpdateFailed") {
      return {
        status: 502,
        body: {
          ok: false,
          error: "voucherUpdateFailed",
          message: text(result.json?.voucherMessage, 300, config.secret) || "The voucher could not be updated.",
        },
      };
    }
    const error = failure(result.status, result.json);
    if (error || !result.json) {
      const body = error ?? upstream().body;
      return { status: statusFor(body, result.status), body };
    }
    const secret = config.secret;
    return {
      status: 200,
      body: {
        ok: true,
        mode: "applyVoucher",
        business: isBusiness(result.json.business) ? result.json.business : business,
        brand: text(result.json.brand, 80, secret),
        jobId: notionPageId(text(result.json.jobId, 80, secret)) ?? jobId,
        jobUrl: httpsUrl(result.json.jobUrl),
        jobTitle: text(result.json.jobTitle, 200, secret),
        voucherStatus: applyVoucherStatus(result.json.voucherStatus),
        voucherCode: text(result.json.voucherCode, 40, secret),
        voucherValue: voucherAmount(result.json.voucherValue),
        voucherBusiness: text(result.json.voucherBusiness, 40, secret),
        voucherRedeemedDate: text(result.json.voucherRedeemedDate, 10, secret),
        voucherMessage: text(result.json.voucherMessage, 300, secret),
        noteWritten: flag(result.json.noteWritten) ?? false,
      },
    };
  } catch {
    return upstream();
  }
}

function clipLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max);
}

function clipNote(value: unknown, max: number): string {
  if (typeof value === "string") return clipLine(value, max);
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const item = clipLine(row.item, max);
  const why = clipLine(row.why, max);
  if (!item) return "";
  if (!why) return item;
  const joined = `${item} — ${why}`;
  return joined.length > max ? joined.slice(0, max) : joined;
}

function clipList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clipNote(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function clipTasks(value: unknown): InvoiceTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = clipLine(row.label, 80);
      const text = clipLine(row.text, 2000);
      if (!label && !text) return null;
      return { label, text };
    })
    .filter((row): row is InvoiceTask => row !== null)
    .slice(0, 12);
}

function accepted(json: Record<string, unknown> | null): boolean {
  return json?.ok === true || json?.ok === "true";
}

async function postNewJob(payload: Record<string, unknown>, fetchImpl?: FetchLike) {
  const config = makeConfig();
  if (!config) return { config: null, result: unconfigured() };
  try {
    const result = await postJson(config.newJob, { secret: config.secret, ...payload }, fetchImpl ?? globalThis.fetch, JSON_TIMEOUT_MS);
    if (result.status === 401 || result.json?.error === "unauthorized") {
      const error = failure(401, result.json) ?? { ok: false as const, error: "webhook_unauthorized", message: "The server key was rejected." };
      return { config, result: { status: statusFor(error, result.status), body: error } };
    }
    return { config, result };
  } catch {
    return { config, result: upstream() };
  }
}

export type InvoiceContext = {
  ok: true;
  mode: "invoiceContext";
  brand: string;
  jobId: string;
  jobUrl: string;
  jobTitle: string;
  customer: { id: string; name: string };
  property: { id: string; name: string };
  suggestedNumber: string;
  latestNumberSeen: string;
  numberNote: string;
  today: string;
  invoicesOnJob: string;
  existingInvoice: { id: string; url: string; number: string; status: string; docIds: string[] };
  reuseExistingPage: boolean;
};

export async function invoiceContext(
  input: { business: Business; type: InvoiceType; jobId: string },
  fetchImpl?: FetchLike,
): Promise<JobsResult<InvoiceContext>> {
  const jobId = cleanJobId(input.jobId.replace(/-/g, ""));
  if (!jobId || !isInvoiceType(input.type) || !isBusiness(input.business)) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "That request was not valid." } };
  }
  const posted = await postNewJob({ mode: "invoiceContext", business: input.business, type: input.type, jobId }, fetchImpl);
  if (!posted.config) return posted.result;
  const result = posted.result;
  if ("body" in result && result.body && "ok" in result.body && result.body.ok === false && result.status !== 200) return result as JobsResult<InvoiceContext>;
  const json = "json" in result ? result.json : null;
  const status = "status" in result ? result.status : 502;
  if (!json || !accepted(json)) {
    const error = failure(status, json);
    return { status: statusFor(error ?? upstream().body, status), body: error ?? upstream().body };
  }
  const secret = posted.config.secret;
  const existing = json.existingInvoice && typeof json.existingInvoice === "object" ? (json.existingInvoice as Record<string, unknown>) : {};
  return {
    status: 200,
    body: {
      ok: true,
      mode: "invoiceContext",
      brand: text(json.brand, 80, secret),
      jobId: text(json.jobId, 80, secret) || jobId,
      jobUrl: httpsUrl(json.jobUrl),
      jobTitle: text(json.jobTitle, 200, secret),
      customer: {
        id: text((json.customer as Record<string, unknown> | undefined)?.id, 80, secret),
        name: text((json.customer as Record<string, unknown> | undefined)?.name, 120, secret),
      },
      property: {
        id: text((json.property as Record<string, unknown> | undefined)?.id, 80, secret),
        name: text((json.property as Record<string, unknown> | undefined)?.name, 200, secret),
      },
      suggestedNumber: text(json.suggestedNumber, 40, secret),
      latestNumberSeen: text(json.latestNumberSeen, 40, secret),
      numberNote: text(json.numberNote, 300, secret),
      today: text(json.today, 40, secret),
      invoicesOnJob: text(json.invoicesOnJob, 20, secret),
      existingInvoice: {
        id: text(existing.id, 80, secret),
        url: httpsUrl(existing.url),
        number: text(existing.number, 40, secret),
        status: text(existing.status, 40, secret),
        docIds: clipList(existing.docIds, 8, 80).map((item) => text(item, 80, secret)),
      },
      reuseExistingPage: flag(json.reuseExistingPage) === true,
    },
  };
}

export type InvoiceDraftResult = {
  ok: true;
  mode: "invoiceDraft";
  draft: {
    primaryObjective: string;
    tasks: InvoiceTask[];
    recommendation: string;
    notesMode: NotesMode | "";
    notesText: string;
    suggestedClauses: string[];
    qaBox: QaChoice | "";
    amountLayoutSuggestion: AmountLayout | "";
    multiVisit: boolean;
    jobType: string;
    scopeArea: string;
    depositObjective: string;
    conditions: string[];
    missing: string[];
    questions: string[];
  };
};

export async function invoiceDraft(
  input: { business: Business; type: InvoiceType; jobId: string; dictation: string },
  fetchImpl?: FetchLike,
): Promise<JobsResult<InvoiceDraftResult>> {
  const jobId = cleanJobId(input.jobId.replace(/-/g, ""));
  const dictation = clipLine(input.dictation, 8000);
  if (!jobId || !dictation || !isInvoiceType(input.type) || !isBusiness(input.business)) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Say what the invoice should cover." } };
  }
  const posted = await postNewJob({ mode: "invoiceDraft", business: input.business, type: input.type, jobId, dictation }, fetchImpl);
  if (!posted.config) return posted.result;
  const result = posted.result;
  if ("body" in result && result.body && "ok" in result.body && result.body.ok === false && !("json" in result)) return result as JobsResult<InvoiceDraftResult>;
  const json = "json" in result ? result.json : null;
  const status = "status" in result ? result.status : 502;
  if (!json || !accepted(json)) {
    const error = failure(status, json);
    return { status: statusFor(error ?? upstream().body, status), body: error ?? upstream().body };
  }
  const secret = posted.config.secret;
  const draft = json.draft && typeof json.draft === "object" ? (json.draft as Record<string, unknown>) : {};
  const notesMode = isNotesMode(draft.notesMode) ? draft.notesMode : "";
  const qaBox = isQaChoice(draft.qaBox) ? draft.qaBox : "";
  const layout = isAmountLayout(draft.amountLayoutSuggestion) ? draft.amountLayoutSuggestion : "";
  return {
    status: 200,
    body: {
      ok: true,
      mode: "invoiceDraft",
      draft: {
        primaryObjective: text(draft.primaryObjective, 2000, secret),
        tasks: clipTasks(draft.tasks).map((row) => ({ label: text(row.label, 80, secret), text: text(row.text, 2000, secret) })),
        recommendation: text(draft.recommendation, 2000, secret),
        notesMode,
        notesText: text(draft.notesText, 4000, secret),
        suggestedClauses: clipList(draft.suggestedClauses, 12, 300).map((item) => text(item, 300, secret)),
        qaBox,
        amountLayoutSuggestion: layout,
        multiVisit: flag(draft.multiVisit) === true,
        jobType: text(draft.jobType, 80, secret),
        scopeArea: text(draft.scopeArea, 300, secret),
        depositObjective: text(draft.depositObjective, 500, secret),
        conditions: clipList(draft.conditions, 12, 300).map((item) => text(item, 300, secret)),
        missing: clipList(draft.missing, 12, 300).map((item) => text(item, 300, secret)),
        questions: clipList(draft.questions, 12, 300).map((item) => text(item, 300, secret)),
      },
    },
  };
}

export type InvoiceCreateInput = {
  business: Business;
  type: InvoiceType;
  jobId: string;
  invoiceNumber: string;
  primaryObjective: string;
  tasks: InvoiceTask[];
  recommendation: string;
  notesMode: NotesMode;
  notesText: string;
  qaBox: QaChoice;
  amountLayout: AmountLayout;
  labourLabel?: string;
  keepCallout?: boolean;
  variationDesc?: string;
  scopeArea?: string;
  depositObjective?: string;
  conditions?: string[];
};

export type InvoiceCreated = {
  ok: true;
  mode: "invoiceCreate";
  status: "created" | "exists" | "pending";
  invoicePageId: string;
  notionUrl: string;
  invoiceNumber: string;
  docId: string;
  docUrl: string;
  templateCheck: string;
  isTest: boolean;
  message: string;
};

export function invoiceCreateBody(input: InvoiceCreateInput): Record<string, unknown> | null {
  const jobId = cleanJobId(input.jobId.replace(/-/g, ""));
  const invoiceNumber = clipLine(input.invoiceNumber, 40);
  if (!jobId || !invoiceNumber || !isInvoiceType(input.type) || !isBusiness(input.business)) return null;
  if (!isNotesMode(input.notesMode) || !isQaChoice(input.qaBox) || !isAmountLayout(input.amountLayout)) return null;
  const body: Record<string, unknown> = {
    mode: "invoiceCreate",
    business: input.business,
    type: input.type,
    jobId,
    invoiceNumber,
    primaryObjective: clipLine(input.primaryObjective, 2000),
    tasks: clipTasks(input.tasks),
    recommendation: clipLine(input.recommendation, 2000),
    notesMode: input.notesMode,
    notesText: clipLine(input.notesText, 4000),
    qaBox: input.qaBox,
    amountLayout: input.amountLayout,
  };
  const labour = clipLine(input.labourLabel, 80);
  const variation = clipLine(input.variationDesc, 500);
  const scope = clipLine(input.scopeArea, 300);
  const objective = clipLine(input.depositObjective, 500);
  const conditions = clipList(input.conditions, 12, 300);
  if (labour) body.labourLabel = labour;
  if (typeof input.keepCallout === "boolean") body.keepCallout = input.keepCallout;
  if (variation) body.variationDesc = variation;
  if (scope) body.scopeArea = scope;
  if (objective) body.depositObjective = objective;
  if (conditions.length > 0) body.conditions = conditions;
  return body;
}

export async function invoiceCreate(input: InvoiceCreateInput, fetchImpl?: FetchLike): Promise<JobsResult<InvoiceCreated>> {
  const payload = invoiceCreateBody(input);
  if (!payload) return { status: 400, body: { ok: false, error: "bad_request", message: "The invoice number is missing." } };
  const posted = await postNewJob(payload, fetchImpl);
  if (!posted.config) return posted.result;
  const result = posted.result;
  if ("body" in result && result.body && "ok" in result.body && result.body.ok === false && !("json" in result)) return result as JobsResult<InvoiceCreated>;
  const json = "json" in result ? result.json : null;
  const status = "status" in result ? result.status : 502;
  if (status === 202) {
    return { status: 202, body: { ok: true, mode: "invoiceCreate", status: "pending", invoicePageId: "", notionUrl: "", invoiceNumber: "", docId: "", docUrl: "", templateCheck: "", isTest: false, message: "Still generating the document." } };
  }
  if (status === 400) {
    return { status: 400, body: { ok: false, error: text(json?.error, 40, posted.config.secret) || "bad_request", message: text(json?.message, 300, posted.config.secret) || "The invoice was not created." } };
  }
  if (!json || !accepted(json)) {
    const error = failure(status, json);
    return { status: statusFor(error ?? upstream().body, status), body: error ?? upstream().body };
  }
  const secret = posted.config.secret;
  const created = text(json.status, 20, secret);
  return {
    status: 200,
    body: {
      ok: true,
      mode: "invoiceCreate",
      status: created === "exists" ? "exists" : "created",
      invoicePageId: text(json.invoicePageId, 80, secret),
      notionUrl: httpsUrl(json.notionUrl),
      invoiceNumber: text(json.invoiceNumber, 40, secret),
      docId: text(json.docId, 120, secret),
      docUrl: httpsUrl(json.docUrl),
      templateCheck: text(json.templateCheck, 200, secret),
      isTest: flag(json.isTest) === true,
      message: created === "exists" ? existingInvoiceMessage(text(json.invoiceNumber, 40, secret) || clipLine(input.invoiceNumber, 40)) : "Word draft is ready.",
    },
  };
}
