import { smsAddressesMatch } from "@/lib/sms-address";
import { isAllowedSmsStatus, isSmsTestJob, smsIncludeTestJobs, smsJobStage, smsJobStatuses } from "@/lib/sms-job-statuses";
import { normalizePhone } from "@/lib/jobs-app/phones";
import { isBusiness, type Business, type JobsError } from "@/lib/jobs-app/types";
import { cleanJobId } from "@/lib/jobs-app/webhooks";

/**
 * Active jobs are read from the Emoro and Emporo Notion Jobs databases,
 * filtered by the status names in sms-job-statuses.ts. Tenant names and
 * mobiles are read from "Tenant contacts (not Owner)".
 * The only Notion write is saveTenantPhone, and only after Pat confirms.
 * Nothing here calls the Depart, Leave, or new-job webhooks.
 */

export type SmsJobContact = {
  name: string;
  phone: string;
};

export type SmsTenantPage = {
  pageId: string;
  name: string;
  phone: string;
};

export type SmsPhoneLink = {
  business: Business;
  jobId: string;
  name: string;
  phone: string;
};

export type SmsOpenJob = {
  business: Business;
  jobId: string;
  title: string;
  address: string;
  status: string;
  scheduled: string;
};

const notionVersion = "2022-06-28";
const tenantDatabases: Record<Business, { database: string; relation: string }> = {
  emoro: { database: "d1da6a01-0507-43fc-9e3f-72a16f34a342", relation: "Jobs" },
  emporo: { database: "38c91037-f9ca-80ac-bef4-c824f3e1c3ef", relation: "Jobs (Plumbing)" },
};
const jobDatabases: Record<Business, { database: string; address: string }> = {
  emoro: { database: "ff086255-3e2c-4e2b-a462-fe183e32b1ba", address: "Property Address (rollup)" },
  emporo: { database: "38c91037-f9ca-80fd-a313-d6833c2e589d", address: "Address Rollup" },
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function oneLine(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function plainText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const title = (value as { title?: unknown }).title;
  if (!Array.isArray(title)) return "";
  const text = title
    .map((part) => (part && typeof part === "object" && typeof (part as { plain_text?: unknown }).plain_text === "string" ? (part as { plain_text: string }).plain_text : ""))
    .join("");
  return oneLine(text, 80);
}

function phoneText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const phone = (value as { phone_number?: unknown }).phone_number;
  return typeof phone === "string" ? phone : "";
}

function selectText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const select = (value as { select?: unknown }).select;
  if (!select || typeof select !== "object") return "";
  const name = (select as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => (part && typeof part === "object" && typeof (part as { plain_text?: unknown }).plain_text === "string" ? (part as { plain_text: string }).plain_text : ""))
    .join("");
}

function rollupAddress(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const rollup = (value as { rollup?: unknown }).rollup;
  if (!rollup || typeof rollup !== "object") return "";
  const array = (rollup as { array?: unknown }).array;
  if (!Array.isArray(array)) return "";
  const text = array
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      return richText((item as { title?: unknown }).title);
    })
    .filter(Boolean)
    .join(", ");
  return oneLine(text, 200);
}

function dateText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const date = (value as { date?: unknown }).date;
  if (!date || typeof date !== "object") return "";
  const start = (date as { start?: unknown }).start;
  return typeof start === "string" ? oneLine(start, 40) : "";
}

/** Keep tenant rows and drop an Owner row if one is returned. Phones become +61. */
export function tenantContactsFromNotion(payload: unknown): SmsJobContact[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const contacts: SmsJobContact[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const properties = (item as { properties?: unknown }).properties;
    if (!properties || typeof properties !== "object") continue;
    const row = properties as Record<string, unknown>;
    if (selectText(row.Select).toLowerCase() === "owner") continue;
    const phone = normalizePhone(phoneText(row.Phone));
    if (!phone || contacts.some((contact) => contact.phone === phone)) continue;
    contacts.push({ name: plainText(row.Name), phone });
    if (contacts.length >= 10) break;
  }
  return contacts;
}

/** Tenant rows including a contact whose phone is still empty. Owners are dropped. */
export function tenantPagesFromNotion(payload: unknown): SmsTenantPage[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const pages: SmsTenantPage[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const page = item as { id?: unknown; properties?: unknown };
    const pageId = cleanJobId(typeof page.id === "string" ? page.id : "");
    if (!pageId || !page.properties || typeof page.properties !== "object") continue;
    const row = page.properties as Record<string, unknown>;
    if (selectText(row.Select).toLowerCase() === "owner") continue;
    pages.push({ pageId, name: plainText(row.Name), phone: normalizePhone(phoneText(row.Phone)) ?? "" });
    if (pages.length >= 10) break;
  }
  return pages;
}

function relationIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const relation = (value as { relation?: unknown }).relation;
  if (!Array.isArray(relation)) return [];
  const ids: string[] = [];
  for (const item of relation) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) ids.push(id.trim());
  }
  return ids;
}

function sameJob(left: string, right: string): boolean {
  return left.replace(/-/g, "").toLowerCase() === right.replace(/-/g, "").toLowerCase();
}

/** Contacts that carry this mobile, and the jobs they are linked to. */
export function phoneLinksFromNotion(payload: unknown, business: Business): SmsPhoneLink[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const relation = tenantDatabases[business].relation;
  const links: SmsPhoneLink[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const properties = (item as { properties?: unknown }).properties;
    if (!properties || typeof properties !== "object") continue;
    const row = properties as Record<string, unknown>;
    if (selectText(row.Select).toLowerCase() === "owner") continue;
    const phone = normalizePhone(phoneText(row.Phone));
    if (!phone) continue;
    const name = plainText(row.Name);
    for (const jobId of relationIds(row[relation])) {
      const id = cleanJobId(jobId);
      if (!id) continue;
      links.push({ business, jobId: id, name, phone });
    }
  }
  return links;
}

export function phoneQuery(business: Business, phone: string): { url: string; body: string } {
  const source = tenantDatabases[business];
  const national = phone.replace(/^\+61/, "");
  return {
    url: `https://api.notion.com/v1/databases/${source.database}/query`,
    body: JSON.stringify({
      page_size: 20,
      filter: {
        and: [
          { property: "Select", select: { does_not_equal: "Owner" } },
          {
            or: [
              { property: "Phone", phone_number: { equals: phone } },
              { property: "Phone", phone_number: { contains: national } },
            ],
          },
        ],
      },
    }),
  };
}

/** Active jobs whose current tenant contact has this mobile. Closed jobs are ignored. */
export function matchJobsByPhone(phone: string, jobs: SmsOpenJob[], links: SmsPhoneLink[], includeTest = smsIncludeTestJobs()): SmsOpenJob[] {
  const target = normalizePhone(phone);
  if (!target) return [];
  const active = keepActiveSmsJobs(jobs, includeTest);
  const seen = new Set<string>();
  const matched: SmsOpenJob[] = [];
  for (const link of links) {
    if (normalizePhone(link.phone) !== target) continue;
    const job = active.find((item) => item.business === link.business && sameJob(item.jobId, link.jobId));
    if (!job) continue;
    const key = `${job.business}:${job.jobId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push(job);
  }
  return matched.sort(compareSmsJobs);
}

export type TenantSavePlan = { action: "already" } | { action: "update"; pageId: string } | { action: "create" };

/** Use an empty tenant phone when there is one. Never replace a phone that is already set. */
export function planTenantSave(phone: string, pages: SmsTenantPage[]): TenantSavePlan {
  const target = normalizePhone(phone);
  if (!target) return { action: "already" };
  if (pages.some((page) => normalizePhone(page.phone) === target)) return { action: "already" };
  const empty = pages.find((page) => !normalizePhone(page.phone));
  if (empty) return { action: "update", pageId: empty.pageId };
  return { action: "create" };
}

export function tenantCreateBody(business: Business, jobId: string, phone: string, name: string): Record<string, unknown> {
  const source = tenantDatabases[business];
  const cleaned = name.replace(/[\u0000-\u001F]/g, " ").trim().slice(0, 80);
  const title = !cleaned || normalizePhone(cleaned) ? "Tenant" : cleaned;
  return {
    parent: { database_id: source.database },
    properties: {
      Name: { title: [{ type: "text", text: { content: title } }] },
      Phone: { phone_number: phone },
      Select: { select: { name: "Tenant" } },
      [source.relation]: { relation: [{ id: jobId }] },
    },
  };
}

function notionHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "notion-version": notionVersion,
  };
}

export function tenantQuery(business: Business, jobId: string): { url: string; body: string } {
  const source = tenantDatabases[business];
  return {
    url: `https://api.notion.com/v1/databases/${source.database}/query`,
    body: JSON.stringify({
      page_size: 10,
      filter: {
        and: [
          { property: source.relation, relation: { contains: jobId } },
          { property: "Select", select: { does_not_equal: "Owner" } },
        ],
      },
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    }),
  };
}

export function jobsQuery(business: Business): { url: string; body: string } {
  const source = jobDatabases[business];
  return {
    url: `https://api.notion.com/v1/databases/${source.database}/query`,
    body: JSON.stringify({
      page_size: 100,
      filter: {
        or: smsJobStatuses[business].map((name) => ({ property: "Status", select: { equals: name } })),
      },
    }),
  };
}

/** Read job rows. Status filtering happens in keepActiveSmsJobs. */
export function jobsFromNotion(payload: unknown, business: Business): SmsOpenJob[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const addressKey = jobDatabases[business].address;
  const jobs: SmsOpenJob[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const page = item as { id?: unknown; properties?: unknown };
    const jobId = cleanJobId(typeof page.id === "string" ? page.id : "");
    if (!jobId || !page.properties || typeof page.properties !== "object") continue;
    const row = page.properties as Record<string, unknown>;
    const title = plainText(row.Job);
    const status = oneLine(selectText(row.Status), 80);
    if (!title || !status) continue;
    jobs.push({
      business,
      jobId,
      title,
      address: rollupAddress(row[addressKey]),
      status,
      scheduled: dateText(row["Scheduled Date"]),
    });
  }
  return jobs;
}

/** Keep the configured active statuses. Drop TEST titles in production. */
export function keepActiveSmsJobs(jobs: SmsOpenJob[], includeTest = smsIncludeTestJobs()): SmsOpenJob[] {
  return jobs.filter((job) => isAllowedSmsStatus(job.status) && (includeTest || !isSmsTestJob(job.title)));
}

export function compareSmsJobs(left: SmsOpenJob, right: SmsOpenJob): number {
  const stage = smsJobStage(left.status) - smsJobStage(right.status);
  if (stage !== 0) return stage;
  const address = (left.address || left.title).localeCompare(right.address || right.title, "en-AU");
  if (address !== 0) return address;
  return left.title.localeCompare(right.title, "en-AU");
}

/**
 * Match one address to active jobs only. A completed or cancelled job with the
 * same address is ignored, even when it is passed in.
 */
export function matchActiveSmsJobs(address: string, jobs: SmsOpenJob[], includeTest = smsIncludeTestJobs()): SmsOpenJob[] {
  if (!address.trim()) return [];
  return keepActiveSmsJobs(jobs, includeTest)
    .filter((job) => smsAddressesMatch(address, job.address || job.title))
    .sort(compareSmsJobs);
}

async function queryBrandJobs(business: Business, token: string, call: FetchLike): Promise<SmsOpenJob[] | null> {
  const first = jobsQuery(business);
  let cursor = "";
  const jobs: SmsOpenJob[] = [];
  for (let page = 0; page < 5; page += 1) {
    const body = cursor ? JSON.stringify({ ...JSON.parse(first.body), start_cursor: cursor }) : first.body;
    const response = await call(first.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "notion-version": notionVersion,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as unknown;
    jobs.push(...jobsFromNotion(payload, business));
    const row = payload && typeof payload === "object" ? (payload as { has_more?: unknown; next_cursor?: unknown }) : {};
    const next = typeof row.next_cursor === "string" ? row.next_cursor : "";
    if (row.has_more !== true || !next) break;
    cursor = next;
  }
  return jobs;
}

export async function listSmsJobs(fetchImpl?: FetchLike): Promise<{ status: number; body: { ok: true; jobs: SmsOpenJob[] } | JobsError }> {
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!token) return { status: 503, body: { ok: false, error: "unconfigured", message: "Jobs database not connected." } };
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const [emoro, emporo] = await Promise.all([queryBrandJobs("emoro", token, call), queryBrandJobs("emporo", token, call)]);
    if (!emoro || !emporo) return { status: 502, body: { ok: false, error: "upstream", message: "The job list could not be loaded." } };
    const jobs = keepActiveSmsJobs([...emoro, ...emporo]).sort(compareSmsJobs);
    return { status: 200, body: { ok: true, jobs } };
  } catch {
    return { status: 502, body: { ok: false, error: "upstream", message: "The job list could not be loaded." } };
  }
}

export async function smsJobContacts(
  business: Business,
  jobId: string,
  fetchImpl?: FetchLike,
): Promise<{ status: number; body: { ok: true; business: Business; jobId: string; contacts: SmsJobContact[] } | JobsError }> {
  const id = cleanJobId(jobId);
  if (!id || !isBusiness(business)) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "That job was not recognised." } };
  }
  const listed = await listSmsJobs(fetchImpl);
  if (!listed.body.ok) return { status: listed.status, body: listed.body };
  const job = listed.body.jobs.find((item) => item.business === business && item.jobId === id);
  if (!job) return { status: 404, body: { ok: false, error: "not_found", message: "That job is not an active job." } };
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!token) return { status: 200, body: { ok: true, business, jobId: id, contacts: [] } };
  const query = tenantQuery(business, id);
  const call = fetchImpl ?? globalThis.fetch;
  try {
    const response = await call(query.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "notion-version": notionVersion,
      },
      body: query.body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { status: 200, body: { ok: true, business, jobId: id, contacts: [] } };
    const payload = (await response.json().catch(() => null)) as unknown;
    return { status: 200, body: { ok: true, business, jobId: id, contacts: tenantContactsFromNotion(payload) } };
  } catch {
    return { status: 200, body: { ok: true, business, jobId: id, contacts: [] } };
  }
}

export async function findSmsPhones(phone: string, fetchImpl?: FetchLike): Promise<SmsPhoneLink[]> {
  const target = normalizePhone(phone);
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!target || !token) return [];
  const call = fetchImpl ?? globalThis.fetch;
  const found = await Promise.all(
    (["emoro", "emporo"] as const).map(async (business) => {
      const query = phoneQuery(business, target);
      try {
        const response = await call(query.url, {
          method: "POST",
          headers: notionHeaders(token),
          body: query.body,
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) return [];
        return phoneLinksFromNotion((await response.json().catch(() => null)) as unknown, business);
      } catch {
        return [];
      }
    }),
  );
  return found.flat();
}

export async function saveTenantPhone(
  business: Business,
  jobId: string,
  phone: string,
  name: string,
  fetchImpl?: FetchLike,
): Promise<{ status: number; body: { ok: true; action: "already" | "updated" | "created"; phone: string } | JobsError }> {
  const id = cleanJobId(jobId);
  const target = normalizePhone(phone);
  if (!id || !isBusiness(business) || !target) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "That number could not be saved." } };
  }
  const listed = await listSmsJobs(fetchImpl);
  if (!listed.body.ok) return { status: listed.status, body: listed.body };
  const job = listed.body.jobs.find((item) => item.business === business && sameJob(item.jobId, id));
  if (!job) return { status: 404, body: { ok: false, error: "not_found", message: "That job is not an active job." } };
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!token) return { status: 503, body: { ok: false, error: "unconfigured", message: "Jobs database not connected." } };
  const query = tenantQuery(business, job.jobId);
  const call = fetchImpl ?? globalThis.fetch;
  let pages: SmsTenantPage[] = [];
  try {
    const response = await call(query.url, {
      method: "POST",
      headers: notionHeaders(token),
      body: query.body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { status: 502, body: { ok: false, error: "upstream", message: "The tenant contact could not be saved." } };
    pages = tenantPagesFromNotion((await response.json().catch(() => null)) as unknown);
  } catch {
    return { status: 502, body: { ok: false, error: "upstream", message: "The tenant contact could not be saved." } };
  }
  const plan = planTenantSave(target, pages);
  if (plan.action === "already") return { status: 200, body: { ok: true, action: "already", phone: target } };
  try {
    if (plan.action === "update") {
      const response = await call(`https://api.notion.com/v1/pages/${plan.pageId}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({ properties: { Phone: { phone_number: target } } }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return { status: 502, body: { ok: false, error: "upstream", message: "The tenant contact could not be saved." } };
      return { status: 200, body: { ok: true, action: "updated", phone: target } };
    }
    const response = await call("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify(tenantCreateBody(business, job.jobId, target, name)),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { status: 502, body: { ok: false, error: "upstream", message: "The tenant contact could not be saved." } };
    return { status: 200, body: { ok: true, action: "created", phone: target } };
  } catch {
    return { status: 502, body: { ok: false, error: "upstream", message: "The tenant contact could not be saved." } };
  }
}
