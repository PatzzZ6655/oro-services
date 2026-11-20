import { normalizePhone } from "@/lib/jobs-app/phones";
import { LEAVE_MAX_PHOTOS, NEW_JOB_MAX_IMAGES, UPLOAD_BUDGET_BYTES } from "@/lib/jobs-app/photos";
import { cleanVoucherCode, voucherStatus } from "@/lib/jobs-app/voucher";
import {
  isBusiness,
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
  return { status: 503, body: { ok: false, error: "unconfigured", message: "服务器还没配好。" } };
}

function upstream(): JobsResult<never> {
  return { status: 502, body: { ok: false, error: "upstream", message: "服务器没有返回内容。请稍后再试。" } };
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
    return { ok: false, error: "no_open_visit", message: "这个工单没有未离开的到访。请先点「出发」。" };
  }
  if (status === 401 || raw === "unauthorized") {
    return { ok: false, error: "webhook_unauthorized", message: "密钥错误。" };
  }
  if (raw === "noAddress") return { ok: false, error: "no_address", message: "没读到地址，请换更清楚的截图。" };
  if (raw === "needBusiness") return { ok: false, error: "need_business", message: "看不出是 Emoro 还是 Emporo，请重试并选择。" };
  return { ok: false, error: "upstream", message: "服务器没有返回内容。请稍后再试。" };
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

async function postJson(url: string, payload: Record<string, string>, call: FetchLike, timeout: number): Promise<{ status: number; json: Record<string, unknown> | null }> {
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
      return { ok: false, status: 400, body: { ok: false, error: "bad_request", message: "请选择 JPEG 照片。" } };
    }
    if (files.length >= maxCount) {
      const message = field === "images" ? "最多 4 张截图。" : "照片太多，请少选几张。";
      return { ok: false, status: 400, body: { ok: false, error: "bad_request", message } };
    }
    total += item.size;
    if (item.size > UPLOAD_BUDGET_BYTES || total > UPLOAD_BUDGET_BYTES) {
      return { ok: false, status: 413, body: { ok: false, error: "too_large", message: "照片太大，请少选几张。" } };
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
    return { status: 400, body: { ok: false, error: "bad_request", message: "请求不对" } };
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

export async function createJob(form: FormData, fetchImpl?: FetchLike): Promise<JobsResult<NewJobResult>> {
  const business = form.get("business");
  if (!isBusiness(business)) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "请选择 Emoro 还是 Emporo。" } };
  }
  const images = await readUpload(form, "images", NEW_JOB_MAX_IMAGES);
  if (!images.ok) return images;
  if (images.files.length === 0) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "请选择截图。" } };
  }
  const config = makeConfig();
  if (!config) return unconfigured();
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const voucher = cleanVoucherCode(fieldText(form.get("voucher"), 40));
    const fields: Record<string, string> = { secret: config.secret, business };
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
        jobTitle: text(result.json.jobTitle, 200, secret),
        brand: text(result.json.brand, 80, secret),
        address: text(result.json.address, 300, secret),
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
        propertyCreated: flag(result.json.propertyCreated),
        customerCreated: flag(result.json.customerCreated),
        contact1Created: flag(result.json.contact1Created),
        voucherStatus: voucherStatus(result.json.voucherStatus),
        voucherCode: text(result.json.voucherCode, 40, secret),
        voucherValue: text(result.json.voucherValue, 20, secret),
        voucherMessage: text(result.json.voucherMessage, 300, secret),
      },
    };
  } catch {
    return upstream();
  }
}
