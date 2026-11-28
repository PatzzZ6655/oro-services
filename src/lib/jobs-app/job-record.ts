import {
  contactCardName,
  contactRole,
  neighbourProgress,
  notionSelectName,
  type ContactRole,
  type NeighbourProgress,
} from "@/lib/jobs-app/contact-groups";
import { contactSyncPayload, groupEmailPayload, keyPickupPayload, type ContactSyncPayload, type GroupEmailPayload, type KeyPickupPayload } from "@/lib/jobs-app/group-messages";
import { isBusiness, type Business } from "@/lib/jobs-app/types";
import { normalizePhone } from "@/lib/jobs-app/phones";
import { cleanJobId } from "@/lib/jobs-app/webhooks";

const notionVersion = "2025-09-03";

const jobs: Record<Business, { dataSource: string; address: string }> = {
  emoro: { dataSource: "e2a99c4d-87e9-4f3d-a99f-35d777781c32", address: "Property Address (rollup)" },
  emporo: { dataSource: "e9b91037-f9ca-8388-abb9-87e3f743cb6d", address: "Address Rollup" },
};

const contactsDb: Record<Business, { dataSource: string; relation: string }> = {
  emoro: { dataSource: "8df4fd74-0cdb-426e-8c42-d45038551b7d", relation: "Jobs" },
  emporo: { dataSource: "60491037-f9ca-82cd-b1ef-072c1552caee", relation: "Jobs (Plumbing)" },
};

export type JobContact = {
  pageId: string;
  name: string;
  phone: string;
  email: string;
  role: ContactRole;
  googleStatus: string;
};

export type JobRecord = {
  business: Business;
  jobId: string;
  title: string;
  address: string;
  status: string;
  scheduled: string;
  vacant: boolean;
  keyPickupDate: string;
  keyEmailStatus: string;
  keysReturned: boolean;
  keysReturnedAt: string;
  neighbour: NeighbourProgress;
  neighbourAt: string;
  description: string;
  customer: string;
  contacts: JobContact[];
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function token(): string {
  return process.env.NOTION_TOKEN?.trim() ?? "";
}

function headers(secret: string): Record<string, string> {
  return { authorization: `Bearer ${secret}`, "content-type": "application/json", "notion-version": notionVersion };
}

function oneLine(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function titleText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const title = (value as { title?: unknown }).title;
  if (!Array.isArray(title)) return "";
  return oneLine(title.map((part) => (part && typeof part === "object" && typeof (part as { plain_text?: unknown }).plain_text === "string" ? (part as { plain_text: string }).plain_text : "")).join(""), 200);
}

function rich(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const text = (value as { rich_text?: unknown }).rich_text;
  if (!Array.isArray(text)) return "";
  return oneLine(text.map((part) => (part && typeof part === "object" && typeof (part as { plain_text?: unknown }).plain_text === "string" ? (part as { plain_text: string }).plain_text : "")).join(""), 2000);
}

function selectName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const select = (value as { select?: unknown }).select;
  if (!select || typeof select !== "object") return "";
  const name = (select as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function checked(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { checkbox?: unknown }).checkbox === true);
}

function dateStart(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const date = (value as { date?: unknown }).date;
  if (!date || typeof date !== "object") return "";
  const start = (date as { start?: unknown }).start;
  return typeof start === "string" ? start.slice(0, 40) : "";
}

function phoneOf(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const phone = (value as { phone_number?: unknown }).phone_number;
  return typeof phone === "string" ? phone : "";
}

function emailOf(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const email = (value as { email?: unknown }).email;
  return typeof email === "string" ? email : "";
}

function rollupTitle(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const rollup = (value as { rollup?: unknown }).rollup;
  if (!rollup || typeof rollup !== "object") return "";
  const array = (rollup as { array?: unknown }).array;
  if (!Array.isArray(array)) return "";
  return oneLine(array.map((item) => titleText(item)).filter(Boolean).join(", "), 200);
}

function relationIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const relation = (value as { relation?: unknown }).relation;
  if (!Array.isArray(relation)) return [];
  return relation.flatMap((item) => (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []));
}

export function contactCreateBody(business: Business, jobId: string, input: { name: string; phone: string; email: string; role: ContactRole }): Record<string, unknown> {
  const source = contactsDb[business];
  const properties: Record<string, unknown> = {
    Name: { title: [{ type: "text", text: { content: oneLine(input.name, 80) || roleLabelFallback(input.role) } }] },
    Select: { select: { name: notionSelectName(input.role) } },
    [source.relation]: { relation: [{ id: jobId }] },
    "Google Contact Status": { select: { name: input.phone ? "pending" : "no phone" } },
  };
  if (input.phone) properties.Phone = { phone_number: input.phone };
  if (input.email) properties.Email = { email: input.email };
  return { parent: { type: "data_source_id", data_source_id: source.dataSource }, properties };
}

function roleLabelFallback(role: ContactRole): string {
  return notionSelectName(role);
}

export function contactUpdateProperties(input: { name: string; phone: string; email: string; role: ContactRole }): Record<string, unknown> {
  return {
    Name: { title: [{ type: "text", text: { content: oneLine(input.name, 80) || roleLabelFallback(input.role) } }] },
    Select: { select: { name: notionSelectName(input.role) } },
    Phone: input.phone ? { phone_number: input.phone } : { phone_number: null },
    Email: input.email.trim() ? { email: oneLine(input.email, 120) } : { email: null },
    "Google Contact Status": { select: { name: input.phone ? "pending" : "no phone" } },
  };
}

export function contactSaved(status: string): boolean {
  return status.trim().toLowerCase() === "saved";
}

export function flagOn(name: "JOB_CONTACT_SYNC" | "JOB_KEY_EMAIL" | "JOB_GROUP_EMAIL"): boolean {
  return process.env[name] === "1";
}

function makeTarget(): { secret: string; url: string } | null {
  const secret = process.env.MAKE_SHORTCUTS_SECRET?.trim() ?? "";
  const url = process.env.MAKE_NEWJOB_URL?.trim() ?? "";
  if (!secret || !url) return null;
  return { secret, url };
}

async function postMake(payload: Record<string, unknown>, fetchImpl?: FetchLike): Promise<{ ok: true } | { ok: false; message: string }> {
  const target = makeTarget();
  if (!target) return { ok: false, message: "The server is not set up yet." };
  const call = fetchImpl ?? globalThis.fetch;
  const response = await call(target.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: target.secret, ...payload }),
  });
  if (!response.ok) return { ok: false, message: "The server did not reply. Try again." };
  return { ok: true };
}

export async function syncContact(input: Omit<ContactSyncPayload, "mode">, fetchImpl?: FetchLike): Promise<{ ok: true; skipped?: boolean } | { ok: false; message: string }> {
  if (!flagOn("JOB_CONTACT_SYNC")) return { ok: true, skipped: true };
  return postMake(contactSyncPayload(input), fetchImpl);
}

export async function sendKeyPickup(input: Omit<KeyPickupPayload, "mode" | "subject" | "body">, fetchImpl?: FetchLike): Promise<{ ok: true; skipped?: boolean } | { ok: false; message: string }> {
  if (!flagOn("JOB_KEY_EMAIL")) return { ok: true, skipped: true };
  return postMake(keyPickupPayload(input), fetchImpl);
}

export async function sendNeighbourEmail(input: Omit<GroupEmailPayload, "mode" | "group">, fetchImpl?: FetchLike): Promise<{ ok: true; skipped?: boolean } | { ok: false; message: string }> {
  if (!flagOn("JOB_GROUP_EMAIL")) return { ok: true, skipped: true };
  return postMake(groupEmailPayload(input), fetchImpl);
}

async function notion(path: string, init: RequestInit, fetchImpl?: FetchLike): Promise<Response | null> {
  const secret = token();
  if (!secret) return null;
  const call = fetchImpl ?? globalThis.fetch;
  return call(`https://api.notion.com/v1/${path}`, { ...init, headers: headers(secret), cache: "no-store" });
}

/** Both job databases show linked people on a relation named Contacts. */
export function linkedContactIds(value: unknown): { ids: string[]; hasMore: boolean } {
  if (!value || typeof value !== "object") return { ids: [], hasMore: false };
  const relation = (value as { relation?: unknown }).relation;
  const ids: string[] = [];
  if (Array.isArray(relation)) {
    for (const item of relation) {
      if (!item || typeof item !== "object") continue;
      const id = cleanJobId((item as { id?: unknown }).id);
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return { ids, hasMore: (value as { has_more?: unknown }).has_more === true };
}

function contactFromPage(item: unknown): JobContact | null {
  if (!item || typeof item !== "object") return null;
  const row = item as { id?: unknown; in_trash?: unknown; archived?: unknown; properties?: Record<string, unknown> };
  if (row.in_trash === true || row.archived === true) return null;
  const pageId = cleanJobId(typeof row.id === "string" ? row.id : "");
  if (!pageId || !row.properties) return null;
  return {
    pageId,
    name: titleText(row.properties.Name),
    phone: normalizePhone(phoneOf(row.properties.Phone)) ?? "",
    email: emailOf(row.properties.Email),
    role: contactRole(selectName(row.properties.Select)),
    googleStatus: selectName(row.properties["Google Contact Status"]),
  };
}

export async function loadJob(business: Business, jobId: string, fetchImpl?: FetchLike): Promise<{ ok: true; job: JobRecord } | { ok: false; status: number; message: string }> {
  const id = cleanJobId(jobId);
  if (!id || !isBusiness(business)) return { ok: false, status: 400, message: "Choose a job." };
  const page = await notion(`pages/${id}`, { method: "GET" }, fetchImpl);
  if (!page || !page.ok) return { ok: false, status: 404, message: "That job could not be read." };
  const json = (await page.json().catch(() => null)) as { properties?: Record<string, unknown> } | null;
  const properties = json?.properties;
  if (!properties) return { ok: false, status: 404, message: "That job could not be read." };
  const source = jobs[business];
  const linked = linkedContactIds(properties.Contacts);
  const fromRelation: JobContact[] = [];
  let relationFailed = false;
  if (linked.ids.length > 0) {
    const read = await Promise.all(linked.ids.map(async (pageId) => {
      const contactPage = await notion(`pages/${pageId}`, { method: "GET" }, fetchImpl);
      if (!contactPage?.ok) return "failed" as const;
      return contactFromPage(await contactPage.json().catch(() => null));
    }));
    for (const item of read) {
      if (item === "failed") relationFailed = true;
      else if (item) fromRelation.push(item);
    }
  }
  const fromQuery: JobContact[] = [];
  let queryFailed = false;
  if (linked.hasMore || fromRelation.length === 0) {
    const listed = await notion(`data_sources/${contactsDb[business].dataSource}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: 50,
        filter: { property: contactsDb[business].relation, relation: { contains: id } },
      }),
    }, fetchImpl);
    if (!listed?.ok) {
      queryFailed = true;
      console.error(`job contacts query ${listed?.status ?? 0}`);
    } else {
      const rows = ((await listed.json().catch(() => null)) as { results?: unknown[] } | null)?.results ?? [];
      for (const item of rows) {
        const contact = contactFromPage(item);
        if (contact) fromQuery.push(contact);
      }
    }
  }
  if (relationFailed || (queryFailed && fromRelation.length === 0)) return { ok: false, status: 502, message: "The contacts could not be read." };
  const seen = new Set<string>();
  const people: JobContact[] = [];
  for (const contact of [...fromRelation, ...fromQuery]) {
    const key = contact.pageId.replace(/-/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(contact);
  }
  const customerIds = relationIds(properties.Customer);
  let customer = "";
  const customerId = customerIds[0];
  if (customerId) {
    const customerPage = await notion(`pages/${customerId}`, { method: "GET" }, fetchImpl);
    if (customerPage?.ok) {
      const body = (await customerPage.json().catch(() => null)) as { properties?: Record<string, unknown> } | null;
      customer = titleText(body?.properties?.Name) || titleText(body?.properties?.Customer);
    }
  }
  return { ok: true, job: {
    business,
    jobId: id,
    title: titleText(properties.Job),
    address: rollupTitle(properties[source.address]),
    status: selectName(properties.Status),
    scheduled: dateStart(properties["Scheduled Date"]),
    vacant: checked(properties["Vacant Collect Keys"]),
    keyPickupDate: dateStart(properties["Key Pickup Date"]),
    keyEmailStatus: selectName(properties["Key Email Status"]),
    keysReturned: checked(properties["Keys Returned"]),
    keysReturnedAt: dateStart(properties["Keys Returned At"]),
    neighbour: neighbourProgress(selectName(properties["Neighbour Contacted"])),
    neighbourAt: dateStart(properties["Neighbour Contacted At"]),
    description: rich(properties["Job Description"]),
    customer,
    contacts: people,
  } };
}

export function contactDisplay(contact: JobContact, address: string): string {
  return contactCardName(contact.name, address, contact.role);
}

export async function createJobContact(
  business: Business,
  jobId: string,
  input: { name: string; phone: string; email: string; role: ContactRole },
  address: string,
  fetchImpl?: FetchLike,
): Promise<{ ok: true; pageId: string; sync: "skipped" | "sent" } | { ok: false; message: string }> {
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (input.phone && !phone) return { ok: false, message: "Enter an Australian mobile." };
  const created = await notion("pages", { method: "POST", body: JSON.stringify(contactCreateBody(business, jobId, { ...input, phone: phone ?? "" })) }, fetchImpl);
  if (!created || !created.ok) return { ok: false, message: "The contact could not be saved." };
  const body = (await created.json().catch(() => null)) as { id?: unknown } | null;
  const pageId = cleanJobId(typeof body?.id === "string" ? body.id : "");
  if (!pageId) return { ok: false, message: "The contact could not be saved." };
  const sync = await syncContact({
    business,
    jobId,
    pageId,
    name: input.name,
    phone: phone ?? "",
    email: input.email,
    role: notionSelectName(input.role),
    displayName: contactCardName(input.name, address, input.role),
  }, fetchImpl);
  if (!sync.ok) return { ok: false, message: sync.message };
  return { ok: true, pageId, sync: sync.skipped ? "skipped" : "sent" };
}

export async function updateJobContact(
  business: Business,
  jobId: string,
  input: { pageId: string; name: string; phone: string; email: string; role: ContactRole },
  address: string,
  fetchImpl?: FetchLike,
): Promise<{ ok: true; sync: "skipped" | "sent" } | { ok: false; message: string }> {
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (input.phone && !phone) return { ok: false, message: "Enter an Australian mobile." };
  const pageId = cleanJobId(input.pageId);
  if (!pageId) return { ok: false, message: "That contact could not be saved." };
  const patched = await notion(`pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: contactUpdateProperties({ ...input, phone: phone ?? "" }) }),
  }, fetchImpl);
  if (!patched?.ok) return { ok: false, message: "The contact could not be saved." };
  const sync = await syncContact({
    business,
    jobId,
    pageId,
    name: input.name,
    phone: phone ?? "",
    email: input.email,
    role: notionSelectName(input.role),
    displayName: contactCardName(input.name, address, input.role),
  }, fetchImpl);
  if (!sync.ok) return { ok: false, message: sync.message };
  return { ok: true, sync: sync.skipped ? "skipped" : "sent" };
}

export async function patchJob(jobId: string, properties: Record<string, unknown>, fetchImpl?: FetchLike): Promise<boolean> {
  const response = await notion(`pages/${jobId}`, { method: "PATCH", body: JSON.stringify({ properties }) }, fetchImpl);
  return Boolean(response?.ok);
}
