import { normalizePhone } from "@/lib/jobs-app/phones";
import { isBusiness, type Business, type JobsError, type TodayJob } from "@/lib/jobs-app/types";
import { cleanJobId, listToday } from "@/lib/jobs-app/webhooks";

/**
 * Today's open jobs come from the same read Depart uses (`listToday` /
 * MAKE_JOBS_TODAY_URL). Tenant names and mobiles are read from the Notion
 * database "Tenant contacts (not Owner)", the query Depart's scenario runs
 * before it writes a visit. This module never calls the Depart, Leave, or
 * new-job webhooks, so it does not record a departure or change Notion.
 */

export type SmsJobContact = {
  name: string;
  phone: string;
};

export type SmsOpenJob = {
  business: Business;
  jobId: string;
  title: string;
  address: string;
};

const notionVersion = "2022-06-28";
const tenantDatabases: Record<Business, { database: string; relation: string }> = {
  emoro: { database: "d1da6a01-0507-43fc-9e3f-72a16f34a342", relation: "Jobs" },
  emporo: { database: "38c91037-f9ca-80ac-bef4-c824f3e1c3ef", relation: "Jobs (Plumbing)" },
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

export function openJob(job: TodayJob): SmsOpenJob {
  return { business: job.business, jobId: job.jobId, title: job.title, address: job.address };
}

export async function listSmsJobs(fetchImpl?: FetchLike): Promise<{ status: number; body: { ok: true; jobs: SmsOpenJob[] } | JobsError }> {
  const listed = await listToday(fetchImpl);
  if (!listed.body.ok) return { status: listed.status, body: listed.body };
  return { status: 200, body: { ok: true, jobs: listed.body.jobs.map(openJob) } };
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
  const listed = await listToday(fetchImpl);
  if (!listed.body.ok) return { status: listed.status, body: listed.body };
  const job = listed.body.jobs.find((item) => item.business === business && item.jobId === id);
  if (!job) return { status: 404, body: { ok: false, error: "not_found", message: "That job is not on today's list." } };
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
