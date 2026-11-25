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
  customer: string;
};

/** Approved order for Contacting Tenant. Any other Contacting* status follows these. */
export const contactingTenantStatusOrder = [
  "Contacting Tenant 0",
  "Contacting Tenant 1",
  "Contacting Tenant 2",
  "Contacting Tenant 3 Cc PM",
  "Contacting Tenant (Waiting)",
] as const;

/** Digest groups for the active-job list, in the approved order. */
export const activeJobGroupSpecs = [
  ["New Work Order", "exact", "New Work Order"],
  ["Quoting", "prefix", "Quoting"],
  ["Quote (Approved)", "exact", "Quote (Approved)"],
  ["In Progress", "prefix", "In Progress"],
  ["Variation", "prefix", "Variation"],
  ["Job Key Appointing", "exact", "Job Key Appointing"],
  ["Contacting", "prefix", "Contacting"],
  ["Time Confirming", "exact", "Time Confirming"],
  ["Awaiting Approval", "exact", "Awaiting Approval"],
  ["Return Visit", "exact", "Return Visit"],
] as const;

export function isNoteGroup(value: unknown): value is NoteGroup {
  return value === "progress" || value === "contacting" || value === "active" || value === "chore";
}

export function noteGroupLabel(group: NoteGroup): string {
  if (group === "progress") return "In Progress";
  if (group === "contacting") return "Contacting Tenant";
  if (group === "active") return "Active Jobs";
  return "Not job-related";
}

export function melbourneYmd(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Word TEST in the title or customer, or a customer named TEST. An address alone does not count. */
export function isOpenClawTestJob(job: Pick<NoteJob, "title" | "customer">): boolean {
  const text = `${job.title} ${job.customer}`.trim();
  return /\bTEST\b/.test(text) || job.customer.trim().toUpperCase() === "TEST";
}

/**
 * A Notion scheduled date that falls on this Melbourne day.
 * Date-only values count as 09:00. Timed values are converted to Melbourne.
 * The jobs app has no Google Calendar, so this is the whole In Progress list.
 */
export function scheduledOnToday(scheduled: string, today: string): boolean {
  const raw = scheduled.trim();
  if (!raw) return false;
  if (raw.length === 10) return raw === today;
  const parsed = new Date(raw.replace("Z", "+00:00"));
  if (Number.isNaN(parsed.getTime())) return false;
  return melbourneYmd(parsed) === today;
}

export function isContactingTenantStatus(status: string): boolean {
  const name = status.trim();
  if (!name) return false;
  return (contactingTenantStatusOrder as readonly string[]).includes(name) || name.startsWith("Contacting");
}

export function matchActiveJobGroup(status: string): string | null {
  const name = status.trim();
  if (!name) return null;
  for (const [group, kind, key] of activeJobGroupSpecs) {
    if (kind === "exact" && name === key) return group;
    if (kind === "prefix" && (name === key || name.startsWith(key))) return group;
  }
  return null;
}

/** Invoicing* and Mark as Job Finish stay out of the active-job digest. */
export function isClosedJobStatus(status: string): boolean {
  const name = status.trim();
  if (!name) return false;
  if (name === "Mark as Job Finish") return true;
  return name === "Invoicing" || name.startsWith("Invoicing ") || name.startsWith("Invoicing(") || name.startsWith("Invoicing_");
}

function brandName(job: NoteJob): string {
  return job.business === "emoro" ? "Emoro" : "Emporo";
}

function progressKey(scheduled: string): string {
  const raw = scheduled.trim();
  if (raw.length === 10) return `${raw}T09:00`;
  const parsed = new Date(raw.replace("Z", "+00:00"));
  if (Number.isNaN(parsed.getTime())) return raw;
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
  return `${melbourneYmd(parsed)}T${clock}`;
}

function byBrandAddress(left: NoteJob, right: NoteJob): number {
  const brand = brandName(left).localeCompare(brandName(right));
  if (brand !== 0) return brand;
  const address = (left.address || "").localeCompare(right.address || "", "en-AU");
  if (address !== 0) return address;
  return (left.customer || "").localeCompare(right.customer || "", "en-AU");
}

export type NoteJobSection = { label: string; jobs: NoteJob[] };

export function noteJobSections(jobs: NoteJob[], group: NoteGroup, today: string): NoteJobSection[] {
  const open = jobs.filter((job) => !isOpenClawTestJob(job));
  if (group === "chore") return [];
  if (group === "progress") {
    const todayJobs = open
      .filter((job) => !job.status.startsWith("Invoicing") && scheduledOnToday(job.scheduled, today))
      .sort((left, right) => progressKey(left.scheduled).localeCompare(progressKey(right.scheduled)) || byBrandAddress(left, right));
    return todayJobs.length > 0 ? [{ label: "", jobs: todayJobs }] : [];
  }
  if (group === "contacting") {
    const rows = open.filter((job) => isContactingTenantStatus(job.status));
    rows.sort((left, right) => {
      const leftIndex = contactingTenantStatusOrder.indexOf(left.status as (typeof contactingTenantStatusOrder)[number]);
      const rightIndex = contactingTenantStatusOrder.indexOf(right.status as (typeof contactingTenantStatusOrder)[number]);
      const order = (leftIndex === -1 ? contactingTenantStatusOrder.length : leftIndex) - (rightIndex === -1 ? contactingTenantStatusOrder.length : rightIndex);
      return order || byBrandAddress(left, right);
    });
    return rows.length > 0 ? [{ label: "", jobs: rows }] : [];
  }
  const sections: NoteJobSection[] = [];
  for (const [name] of activeJobGroupSpecs) {
    const rows = open
      .filter((job) => !isClosedJobStatus(job.status) && matchActiveJobGroup(job.status) === name)
      .sort((left, right) => (left.status || "").localeCompare(right.status || "") || byBrandAddress(left, right));
    if (rows.length > 0) sections.push({ label: name, jobs: rows });
  }
  return sections;
}

export function jobsInGroup(jobs: NoteJob[], group: NoteGroup, today: string): NoteJob[] {
  return noteJobSections(jobs, group, today).flatMap((section) => section.jobs);
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
  for (const job of jobs.filter((item) => !isOpenClawTestJob(item))) {
    const tenant = job.tenant.trim().toLowerCase();
    const street = words(job.address || job.title);
    const number = (job.address.match(/\d+/) ?? [])[0] ?? "";
    const tenantHit = tenant.length > 1 && spoken.includes(tenant);
    const streetHit = street.some((word) => spoken.includes(word)) && (!number || spoken.includes(number));
    if (tenantHit || streetHit) hits.push(job);
  }
  return hits.length === 1 ? hits[0]! : null;
}
