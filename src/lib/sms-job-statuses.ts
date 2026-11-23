/**
 * Exact Status option names from the Notion Jobs databases, read 22 Nov 2026.
 * Emoro Jobs: ff086255-3e2c-4e2b-a462-fe183e32b1ba
 * Emporo Jobs (Plumbing): 38c91037-f9ca-80fd-a313-d6833c2e589d
 *
 * Neither database has "New", "New Job", "Pick Up Keys", or "Return Keys".
 * Those requests map to the option names below. "Contacting Tenant 3" is
 * stored as "Contacting Tenant 3 Cc PM". Edit the lists to change the dropdown.
 *
 * Closed options such as Complete, Cancelled, Draft, and Mark as Job Finish
 * are left out on purpose.
 *
 * Every Status option whose name starts with "In Progress" is included.
 * Re-read from both Jobs databases on 22 Nov 2026:
 * Emoro: In Progress (Collect Key), In Progress, In Progress (Waiting),
 * In Progress (Purchase Material), In Progress (Customer Service),
 * In Progress (Return Key).
 * Emporo: In Progress, In Progress (Purchase Material).
 */

export const smsJobStatuses = {
  emoro: [
    "New Work Order",
    "Contacting Tenant 0",
    "Contacting Tenant 1",
    "Contacting Tenant 2",
    "Contacting Tenant 3 Cc PM",
    "Quoting (Collect Key)",
    "Quoting (Contacting Tenant)",
    "Quoting",
    "Quote (Approved)",
    "Time Confirming",
    "Job Key Appointing",
    "In Progress (Collect Key)",
    "In Progress",
    "In Progress (Waiting)",
    "In Progress (Purchase Material)",
    "In Progress (Customer Service)",
    "In Progress (Return Key)",
  ],
  emporo: [
    "New Work Order",
    "Contacting Tenant 0",
    "Contacting Tenant 1",
    "Contacting Tenant 2",
    "Contacting Tenant 3 Cc PM",
    "Quoting (Contacting Tenant)",
    "Quoting",
    "Quote (Approved)",
    "Time Confirming",
    "Job Key Appointing",
    "In Progress",
    "In Progress (Purchase Material)",
  ],
} as const;

/** Stage order for the dropdown. Earlier stages sort first. */
export const smsJobStageOrder = [
  "New Work Order",
  "Contacting Tenant 0",
  "Contacting Tenant 1",
  "Contacting Tenant 2",
  "Contacting Tenant 3 Cc PM",
  "Quoting (Collect Key)",
  "Quoting (Contacting Tenant)",
  "Quoting",
  "Quote (Approved)",
  "Time Confirming",
  "Job Key Appointing",
  "In Progress (Collect Key)",
  "In Progress",
  "In Progress (Waiting)",
  "In Progress (Purchase Material)",
  "In Progress (Customer Service)",
  "In Progress (Return Key)",
] as const;

/** Show a filter box once the dropdown has more jobs than this. */
export const smsJobSearchAfter = 8;

const allowed = new Set<string>(smsJobStageOrder);

export function isAllowedSmsStatus(status: string): boolean {
  return allowed.has(status);
}

export function smsJobStage(status: string): number {
  const index = smsJobStageOrder.indexOf(status as (typeof smsJobStageOrder)[number]);
  return index === -1 ? smsJobStageOrder.length : index;
}

/** Template ids for each exact status. Unknown labels fall back in suggestTemplates. */
export const smsStageSuggestions: Record<string, Array<{ id: string; variant: string }>> = {
  "New Work Order": [
    { id: "first-visit", variant: "" },
    { id: "follow-up", variant: "" },
  ],
  "Contacting Tenant 0": [
    { id: "first-visit", variant: "" },
    { id: "follow-up", variant: "" },
  ],
  "Contacting Tenant 1": [
    { id: "follow-up", variant: "" },
    { id: "first-visit", variant: "" },
  ],
  "Contacting Tenant 2": [
    { id: "follow-up", variant: "" },
    { id: "cant-reach", variant: "" },
  ],
  "Contacting Tenant 3 Cc PM": [
    { id: "cant-reach", variant: "" },
    { id: "follow-up", variant: "" },
  ],
  "Quoting (Collect Key)": [
    { id: "keys", variant: "collect" },
    { id: "first-visit", variant: "" },
  ],
  "Quoting (Contacting Tenant)": [
    { id: "first-visit", variant: "" },
    { id: "follow-up", variant: "" },
  ],
  Quoting: [
    { id: "first-visit", variant: "" },
    { id: "follow-up", variant: "" },
  ],
  "Quote (Approved)": [
    { id: "confirm", variant: "" },
    { id: "keys", variant: "collect" },
  ],
  "Time Confirming": [
    { id: "confirm", variant: "" },
    { id: "arrival", variant: "today" },
    { id: "reschedule", variant: "" },
  ],
  "Job Key Appointing": [
    { id: "keys", variant: "collect" },
    { id: "confirm", variant: "" },
  ],
  "In Progress (Collect Key)": [
    { id: "keys", variant: "collect" },
    { id: "arrival", variant: "today" },
  ],
  "In Progress": [
    { id: "arrival", variant: "today" },
    { id: "confirm", variant: "" },
  ],
  "In Progress (Waiting)": [
    { id: "follow-up", variant: "" },
    { id: "confirm", variant: "" },
  ],
  "In Progress (Purchase Material)": [
    { id: "return-finish", variant: "" },
    { id: "confirm", variant: "" },
  ],
  "In Progress (Customer Service)": [
    { id: "follow-up", variant: "" },
    { id: "confirm", variant: "" },
  ],
  "In Progress (Return Key)": [{ id: "keys", variant: "return" }],
};

/** A test job title or address starts with TEST, in any case, after trimming. */
export function isSmsTestJob(value: string): boolean {
  return value.trim().toLowerCase().startsWith("test");
}

/**
 * Production hides TEST jobs. Preview, local development, and the test runner
 * keep them, the same split as a TEST invoice that is marked isTest and still shown while testing.
 */
export function smsIncludeTestJobs(env: { VERCEL_ENV?: string } = { VERCEL_ENV: process.env.VERCEL_ENV }): boolean {
  return env.VERCEL_ENV !== "production";
}
