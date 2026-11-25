import { SMS_GEMINI_MODEL, geminiSmsUrl } from "@/lib/sms-reply";
import { cleanJobId } from "@/lib/jobs-app/webhooks";
import { isBusiness, type Business } from "@/lib/jobs-app/types";
import { listAllNotionJobs, type SmsOpenJob } from "@/lib/sms-reply-jobs";
import {
  fallbackNote,
  noteFromGeminiText,
  noteNotionProperties,
  noteTitle,
  type ParsedNote,
  type StoredNote,
} from "@/lib/jobs-app/job-notes";
import type { NoteJob } from "@/lib/jobs-app/note-groups";

const notionVersion = "2025-09-03";
const tenantSources: Record<Business, { dataSource: string; relation: string }> = {
  emoro: { dataSource: "8df4fd74-0cdb-426e-8c42-d45038551b7d", relation: "Jobs" },
  emporo: { dataSource: "60491037-f9ca-82cd-b1ef-072c1552caee", relation: "Jobs (Plumbing)" },
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function noteReadSecret(): string {
  return process.env.JOB_NOTES_READ_SECRET?.trim() ?? "";
}

export function noteShortcutSecret(): string {
  return process.env.JOB_NOTES_SHORTCUT_TOKEN?.trim() ?? "";
}

export function noteDataSource(): string {
  return process.env.NOTION_JOB_NOTES_DATA_SOURCE?.trim() ?? "";
}

export function bearerToken(header: string | null): string {
  const match = /^Bearer\s+(\S+)$/.exec(header ?? "");
  return match?.[1] ?? "";
}

export function noteSecretOk(provided: string, expected: string): boolean {
  if (!expected || expected.length < 16 || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

function plainTitle(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const title = (value as { title?: unknown }).title;
  if (!Array.isArray(title)) return "";
  return title
    .map((part) => (part && typeof part === "object" && typeof (part as { plain_text?: unknown }).plain_text === "string" ? (part as { plain_text: string }).plain_text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function relationIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const relation = (value as { relation?: unknown }).relation;
  if (!Array.isArray(relation)) return [];
  return relation
    .map((item) => (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? cleanJobId((item as { id: string }).id) : null))
    .filter((id): id is string => Boolean(id));
}

/** First tenant name on each job. Owners are skipped. */
export function tenantNamesFromNotion(payload: unknown, business: Business): Map<string, string> {
  const names = new Map<string, string>();
  if (!payload || typeof payload !== "object") return names;
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return names;
  const relation = tenantSources[business].relation;
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const properties = (item as { properties?: unknown }).properties;
    if (!properties || typeof properties !== "object") continue;
    const row = properties as Record<string, unknown>;
    const select = row.Select && typeof row.Select === "object" ? (row.Select as { select?: { name?: unknown } }).select?.name : "";
    if (typeof select === "string" && select.toLowerCase() === "owner") continue;
    const name = plainTitle(row.Name);
    if (!name) continue;
    for (const jobId of relationIds(row[relation])) {
      if (!names.has(jobId)) names.set(jobId, name.slice(0, 80));
    }
  }
  return names;
}

function toNoteJob(job: SmsOpenJob, tenant: string): NoteJob {
  return {
    business: job.business,
    jobId: job.jobId,
    title: job.title,
    address: job.address,
    status: job.status,
    scheduled: job.scheduled,
    tenant,
    customer: job.customer ?? "",
  };
}

export async function listNoteJobs(fetchImpl?: FetchLike): Promise<{ status: number; jobs: NoteJob[]; message: string }> {
  const listed = await listAllNotionJobs(fetchImpl);
  if (!listed.body.ok) return { status: listed.status, jobs: [], message: listed.body.message };
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  const names = new Map<string, string>();
  if (token) {
    const call = fetchImpl ?? globalThis.fetch;
    await Promise.all(
      (["emoro", "emporo"] as const).map(async (business) => {
        try {
          const response = await call(`https://api.notion.com/v1/data_sources/${tenantSources[business].dataSource}/query`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              "notion-version": notionVersion,
            },
            body: JSON.stringify({
              page_size: 100,
              filter: { property: "Select", select: { does_not_equal: "Owner" } },
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
          });
          if (!response.ok) return;
          const found = tenantNamesFromNotion(await response.json().catch(() => null), business);
          for (const [jobId, name] of found) names.set(`${business}:${jobId}`, name);
        } catch {
          // The address list still works when tenant names cannot be read.
        }
      }),
    );
  }
  const jobs = listed.body.jobs
    .map((job) => toNoteJob(job, job.tenant || names.get(`${job.business}:${job.jobId}`) || ""));
  return { status: 200, jobs, message: "" };
}

const systemPrompt = [
  "You turn one spoken site note into JSON.",
  "The speaker mixes Chinese and English. Keep material names, tool names, and notes in the words he used. Do not translate them.",
  "Do not invent items, costs, or stores. A cost is Australian dollars only when he stated one.",
  "Leave dates as he said them.",
  'Return JSON only: {"materials":[{"item":"","qty":"","cost_aud":null,"store":""}],"tools_to_bring":[],"notes":[],"todos":[{"text":"","due":""}]}',
  "Do not write a message to a customer.",
].join(" ");

export async function parseSpokenNote(text: string, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<ParsedNote> {
  const spoken = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!spoken) return fallbackNote("");
  const key = process.env.GEMINI_SMS_API_KEY?.trim() ?? "";
  if (!key) return fallbackNote(spoken);
  try {
    const response = await fetchImpl(geminiSmsUrl(SMS_GEMINI_MODEL), {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: spoken }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return fallbackNote(spoken);
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const raw = parts.filter((part) => part.thought !== true && part.text).map((part) => part.text).join("");
    const parsed = noteFromGeminiText(raw, now);
    if (parsed.materials.length + parsed.tools.length + parsed.notes.length + parsed.todos.length === 0) return fallbackNote(spoken);
    return parsed;
  } catch {
    return fallbackNote(spoken);
  }
}

export async function saveJobNote(
  note: StoredNote,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<{ ok: true; pageId: string } | { ok: false; status: number; message: string }> {
  const source = noteDataSource();
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!source || !token) return { ok: false, status: 503, message: "Job Notes isn't set up yet." };
  if (note.jobId && !cleanJobId(note.jobId)) return { ok: false, status: 400, message: "That job was not recognised." };
  try {
    const response = await fetchImpl("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "notion-version": notionVersion,
      },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: source },
        properties: noteNotionProperties({ ...note, title: note.title || noteTitle(note.text) }, now),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, status: 502, message: "The note could not be saved." };
    const json = (await response.json().catch(() => null)) as { id?: unknown } | null;
    const pageId = cleanJobId(typeof json?.id === "string" ? json.id : "") ?? "";
    return { ok: true, pageId };
  } catch {
    return { ok: false, status: 502, message: "The note could not be saved." };
  }
}

function rich(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const parts = (value as { rich_text?: unknown }).rich_text;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" && typeof (part as { plain_text?: unknown }).plain_text === "string" ? (part as { plain_text: string }).plain_text : ""))
    .join("");
}

export type ReadNote = {
  id: string;
  title: string;
  jobId: string;
  type: "job" | "chore";
  items: ParsedNote & { draft?: boolean; text?: string };
  cost: number;
  created: string;
  needsReview: boolean;
  open: boolean;
};

export function notesFromNotion(payload: unknown): ReadNote[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const notes: ReadNote[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const page = item as { id?: unknown; properties?: unknown };
    const id = cleanJobId(typeof page.id === "string" ? page.id : "");
    if (!id || !page.properties || typeof page.properties !== "object") continue;
    const row = page.properties as Record<string, unknown>;
    const typeName = row.Type && typeof row.Type === "object" ? (row.Type as { select?: { name?: unknown } }).select?.name : "";
    let items: ReadNote["items"] = { materials: [], tools: [], notes: [], todos: [] };
    try {
      const parsed = JSON.parse(rich(row.Items)) as ParsedNote & { draft?: boolean; text?: string };
      items = { ...fallbackNote(""), ...parsed };
    } catch {
      items = fallbackNote(rich(row.Items));
    }
    const cost = row.Cost && typeof row.Cost === "object" && typeof (row.Cost as { number?: unknown }).number === "number" ? (row.Cost as { number: number }).number : 0;
    const created = row.Created && typeof row.Created === "object" ? (row.Created as { date?: { start?: unknown } }).date?.start : "";
    notes.push({
      id,
      title: plainTitle(row.Name).slice(0, 80),
      jobId: rich(row.Job).replace(/-/g, "").slice(0, 32),
      type: typeName === "Chore" ? "chore" : "job",
      items,
      cost,
      created: typeof created === "string" ? created.slice(0, 25) : "",
      needsReview: Boolean(row.Review && typeof row.Review === "object" && (row.Review as { checkbox?: unknown }).checkbox),
      open: Boolean(row.Open && typeof row.Open === "object" && (row.Open as { checkbox?: unknown }).checkbox),
    });
  }
  return notes;
}

export async function readJobNotes(
  query: { jobId?: string; openTodos?: boolean },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; notes: ReadNote[] } | { ok: false; status: number; message: string }> {
  const source = noteDataSource();
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!source || !token) return { ok: false, status: 503, message: "Job Notes isn't set up yet." };
  const filter = query.openTodos
    ? { property: "Open", checkbox: { equals: true } }
    : { property: "Job", rich_text: { contains: (query.jobId ?? "").replace(/-/g, "") } };
  if (!query.openTodos && !cleanJobId(query.jobId ?? "")) return { ok: false, status: 400, message: "That job was not recognised." };
  try {
    const response = await fetchImpl(`https://api.notion.com/v1/data_sources/${source}/query`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "notion-version": notionVersion,
      },
      body: JSON.stringify({ page_size: 20, filter }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, status: 502, message: "The notes could not be read." };
    return { ok: true, notes: notesFromNotion(await response.json().catch(() => null)) };
  } catch {
    return { ok: false, status: 502, message: "The notes could not be read." };
  }
}

export function storedFromParsed(input: {
  text: string;
  parsed: ParsedNote;
  jobId: string;
  type: "job" | "chore";
  needsReview: boolean;
  draft: boolean;
}): StoredNote {
  return {
    ...input.parsed,
    title: noteTitle(input.text),
    text: input.text.slice(0, 1500),
    jobId: input.jobId,
    type: input.type,
    needsReview: input.needsReview,
    draft: input.draft,
  };
}

export function businessOf(value: unknown): Business | null {
  return isBusiness(value) ? value : null;
}
