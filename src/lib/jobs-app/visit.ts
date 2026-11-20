import type { Business } from "@/lib/jobs-app/types";

const KEY = "oro.jobs.visit.v1";

export type ActiveVisit = {
  business: Business;
  jobId: string;
  title: string;
  address: string;
  departedAt: string;
};

export function loadVisit(): ActiveVisit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveVisit>;
    if (parsed.business !== "emoro" && parsed.business !== "emporo") return null;
    if (typeof parsed.jobId !== "string" || !parsed.jobId || typeof parsed.title !== "string" || !parsed.title) return null;
    return {
      business: parsed.business,
      jobId: parsed.jobId.slice(0, 120),
      title: parsed.title.slice(0, 200),
      address: typeof parsed.address === "string" ? parsed.address.slice(0, 300) : "",
      departedAt: typeof parsed.departedAt === "string" ? parsed.departedAt.slice(0, 80) : "",
    };
  } catch {
    return null;
  }
}

export function saveVisit(visit: ActiveVisit): void {
  window.localStorage.setItem(KEY, JSON.stringify(visit));
}

export function clearVisit(): void {
  window.localStorage.removeItem(KEY);
}

export function formatMelbourne(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Australia/Melbourne",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
