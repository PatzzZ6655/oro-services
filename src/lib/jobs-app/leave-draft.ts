import { OPTIONAL_ITEMS, REQUIRED_ITEMS } from "@/lib/jobs-app/checklist";

export const leaveDraftKey = "oro.jobs.leave.draft";

const known = new Set<string>([...REQUIRED_ITEMS, ...OPTIONAL_ITEMS]);
const noteLimit = 4000;

export type LeaveDraft = {
  jobId: string;
  step: "checklist" | "outcome" | "details";
  checked: string[];
  outcome: "return" | "complete" | "";
  notes: string;
  issues: string;
  photoCount: number;
};

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function leaveDraftDirty(draft: LeaveDraft): boolean {
  if (draft.step !== "checklist" || draft.outcome || draft.notes || draft.issues || draft.photoCount > 0) return true;
  return draft.checked.length > 0;
}

export function parseLeaveDraft(raw: string | null): LeaveDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return null;
    const jobId = clip(value.jobId, 120);
    if (!jobId) return null;
    const checked = Array.isArray(value.checked)
      ? value.checked.filter((item): item is string => typeof item === "string" && known.has(item)).slice(0, known.size)
      : [];
    const count = typeof value.photoCount === "number" ? value.photoCount : Number(value.photoCount);
    const draft: LeaveDraft = {
      jobId,
      step: value.step === "outcome" || value.step === "details" ? value.step : "checklist",
      checked,
      outcome: value.outcome === "return" || value.outcome === "complete" ? value.outcome : "",
      notes: clip(value.notes, noteLimit),
      issues: clip(value.issues, noteLimit),
      photoCount: Number.isFinite(count) ? Math.max(0, Math.min(20, Math.floor(count))) : 0,
    };
    return leaveDraftDirty(draft) ? draft : null;
  } catch {
    return null;
  }
}

function store(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function readLeaveSnapshot(): string {
  try {
    const raw = store()?.getItem(leaveDraftKey);
    return raw && raw.length > 0 ? raw : "\0";
  } catch {
    return "\0";
  }
}

export function writeStoredLeaveDraft(draft: LeaveDraft): void {
  const memory = store();
  if (!memory) return;
  try {
    if (!leaveDraftDirty(draft)) {
      const existing = parseLeaveDraft(memory.getItem(leaveDraftKey));
      if (existing?.jobId === draft.jobId) memory.removeItem(leaveDraftKey);
      return;
    }
    memory.setItem(leaveDraftKey, JSON.stringify(draft));
  } catch {
    // A full or blocked store must not stop the checklist.
  }
}

export function clearStoredLeaveDraft(): void {
  try {
    store()?.removeItem(leaveDraftKey);
  } catch {
    // Ignore a blocked store.
  }
}
