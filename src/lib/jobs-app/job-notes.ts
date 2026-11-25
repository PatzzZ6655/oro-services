import { guessNoteJob, melbourneYmd, type NoteJob } from "@/lib/jobs-app/note-groups";

export type NoteMaterial = { item: string; qty: string; costAud: number | null; store: string };
export type NoteTodo = { text: string; due: string };
export type ParsedNote = {
  materials: NoteMaterial[];
  tools: string[];
  notes: string[];
  todos: NoteTodo[];
};

export type StoredNote = ParsedNote & {
  title: string;
  text: string;
  jobId: string;
  type: "job" | "chore";
  needsReview: boolean;
  draft: boolean;
};

const weekdayIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  周日: 0,
  星期一: 1,
  周二: 2,
  星期三: 3,
  周四: 4,
  星期五: 5,
  周六: 6,
  礼拜天: 0,
  礼拜一: 1,
  礼拜二: 2,
  礼拜三: 3,
  礼拜四: 4,
  礼拜五: 5,
  礼拜六: 6,
};

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 100000) return Math.round(value * 100) / 100;
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) return null;
  const amount = Number(match[0]);
  if (!Number.isFinite(amount) || amount < 0 || amount >= 100000) return null;
  return Math.round(amount * 100) / 100;
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

function weekday(now: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Australia/Melbourne", weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Turn a spoken day into a Melbourne calendar date. Unknown phrases stay as spoken. */
export function resolveNoteDate(phrase: string, now = new Date()): string {
  const text = phrase.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const today = melbourneYmd(now);
  if (text === "今天" || /^today$/i.test(text)) return today;
  if (text === "明天" || /^tomorrow$/i.test(text)) return addDays(today, 1);
  if (text === "后天") return addDays(today, 2);
  if (text === "大后天") return addDays(today, 3);
  const index = weekdayIndex[text.toLowerCase()] ?? weekdayIndex[text];
  if (index === undefined) return text.slice(0, 40);
  const delta = (index - weekday(now) + 7) % 7;
  return addDays(today, delta);
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, 20) : [];
}

/** Keep the spoken wording. Drop empty lines. Resolve dates. */
export function normaliseNote(value: unknown, now = new Date()): ParsedNote {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const materials: NoteMaterial[] = [];
  for (const item of rows(row.materials)) {
    if (!item || typeof item !== "object") continue;
    const line = item as Record<string, unknown>;
    const name = clip(line.item, 80);
    if (!name) continue;
    materials.push({ item: name, qty: clip(line.qty, 20), costAud: money(line.cost_aud ?? line.costAud), store: clip(line.store, 40) });
  }
  const tools = rows(row.tools_to_bring ?? row.tools).map((item) => clip(item, 80)).filter(Boolean);
  const notes = rows(row.notes).map((item) => clip(item, 200)).filter(Boolean);
  const todos: NoteTodo[] = [];
  for (const item of rows(row.todos)) {
    if (!item || typeof item !== "object") continue;
    const line = item as Record<string, unknown>;
    const text = clip(line.text, 120);
    if (!text) continue;
    todos.push({ text, due: resolveNoteDate(clip(line.due, 40), now) });
  }
  return { materials, tools, notes, todos };
}

export function noteFromGeminiText(text: string, now = new Date()): ParsedNote {
  const wrapped = text.match(/\{[\s\S]*\}/);
  if (!wrapped) return normaliseNote({}, now);
  try {
    return normaliseNote(JSON.parse(wrapped[0]) as unknown, now);
  } catch {
    return normaliseNote({}, now);
  }
}

export function noteCost(materials: NoteMaterial[]): number {
  const total = materials.reduce((sum, item) => sum + (item.costAud ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export const notePropertyNames = ["Name", "Job", "Type", "Items", "Cost", "Created", "Review", "Open"] as const;

/** Properties for the new Job Notes database. None of these are Jobs database fields. */
export function noteNotionProperties(note: StoredNote, now = new Date()): Record<string, unknown> {
  const items = JSON.stringify({
    draft: note.draft,
    text: note.text.slice(0, 1500),
    materials: note.materials,
    tools: note.tools,
    notes: note.notes,
    todos: note.todos,
  }).slice(0, 1900);
  return {
    Name: { title: [{ type: "text", text: { content: note.title.slice(0, 80) || "Note" } }] },
    Job: { rich_text: note.jobId ? [{ type: "text", text: { content: note.jobId } }] : [] },
    Type: { select: { name: note.type === "chore" ? "Chore" : "Job" } },
    Items: { rich_text: [{ type: "text", text: { content: items } }] },
    Cost: { number: noteCost(note.materials) },
    Created: { date: { start: melbourneYmd(now) } },
    Review: { checkbox: note.needsReview },
    Open: { checkbox: note.todos.length > 0 },
  };
}

export function noteTitle(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return (line || "Note").slice(0, 80);
}

export function fallbackNote(text: string): ParsedNote {
  const line = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return { materials: [], tools: [], notes: line ? [line] : [], todos: [] };
}

export function guessFromSpeech(text: string, jobs: NoteJob[]): NoteJob | null {
  return guessNoteJob(text, jobs);
}
