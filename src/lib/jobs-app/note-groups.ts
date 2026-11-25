import type { Business } from "@/lib/jobs-app/types";

/** The four choices on the note page. They follow the Slack job channels. */
export const noteGroups = ["progress", "contacting", "active", "chore"] as const;

export type NoteGroup = (typeof noteGroups)[number];

export type NoteJob = {
  business: Business;
  jobId: string;
  title: string;
  address: string;
  status: string;
  scheduled: string;
  tenant: string;
};

export function isNoteGroup(value: unknown): value is NoteGroup {
  return value === "progress" || value === "contacting" || value === "active" || value === "chore";
}

export function noteGroupLabel(group: NoteGroup): string {
  if (group === "progress") return "In Progress";
  if (group === "contacting") return "Contacting Tenant";
  if (group === "active") return "Active Jobs";
  return "Not job-related";
}

/** Notion scheduled dates start with the calendar day. */
export function scheduledDay(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? "";
}

export function melbourneYmd(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Today's scheduled in-progress jobs, the same split as the in-progress channel. */
export function inProgressToday(job: NoteJob, today: string): boolean {
  return job.status.startsWith("In Progress") && scheduledDay(job.scheduled) === today;
}

/** Statuses whose name starts with Contacting Tenant, including the Cc PM option. */
export function contactingTenant(job: NoteJob): boolean {
  return job.status.startsWith("Contacting Tenant");
}

export function jobsInGroup(jobs: NoteJob[], group: NoteGroup, today: string): NoteJob[] {
  const picked =
    group === "progress" ? jobs.filter((job) => inProgressToday(job, today)) : group === "contacting" ? jobs.filter((job) => contactingTenant(job)) : group === "active" ? jobs : [];
  return [...picked].sort(compareNoteJobs);
}

/** Emoro first, then Emporo, then the address. */
export function compareNoteJobs(left: NoteJob, right: NoteJob): number {
  const company = (left.business === "emoro" ? 0 : 1) - (right.business === "emoro" ? 0 : 1);
  if (company !== 0) return company;
  const place = (left.address || left.title).localeCompare(right.address || right.title, "en-AU");
  if (place !== 0) return place;
  return left.title.localeCompare(right.title, "en-AU");
}

export function noteJobLabel(job: NoteJob): string {
  const company = job.business === "emoro" ? "🟠 Emoro" : "🔵 Emporo";
  const place = job.address.trim() || job.title.trim();
  const tenant = job.tenant.trim();
  return tenant ? `${company} · ${place} · ${tenant}` : `${company} · ${place}`;
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
}

/** One confident match from the spoken text. Several matches, or none, stay unset. */
export function guessNoteJob(text: string, jobs: NoteJob[]): NoteJob | null {
  const spoken = text.toLowerCase();
  if (spoken.trim().length < 4) return null;
  const hits: NoteJob[] = [];
  for (const job of jobs) {
    const tenant = job.tenant.trim().toLowerCase();
    const street = words(job.address || job.title);
    const number = (job.address.match(/\d+/) ?? [])[0] ?? "";
    const tenantHit = tenant.length > 1 && spoken.includes(tenant);
    const streetHit = street.some((word) => spoken.includes(word)) && (!number || spoken.includes(number));
    if (tenantHit || streetHit) hits.push(job);
  }
  return hits.length === 1 ? hits[0]! : null;
}
