export const leaveNextKey = "oro.jobs.leave.next";

export type LeaveNext = {
  jobId: string;
  date: string;
  time: string;
};

function melbourneDay(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "numeric",
    month: "2-digit",
  }).formatToParts(utc);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const dayText = parts.find((part) => part.type === "day")?.value ?? "";
  const monthText = parts.find((part) => part.type === "month")?.value ?? "";
  if (!weekday || !dayText || !monthText) return null;
  return `${weekday} ${dayText}/${monthText}`;
}

function wallTime(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return null;
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")}${suffix}`;
}

/** Calendar day and optional clock, as Melbourne wall time. Empty date returns null. */
export function formatNextVisit(date: string, time: string): string | null {
  const day = melbourneDay(date);
  if (!day) return null;
  const clock = time.trim() ? wallTime(time) : null;
  if (time.trim() && !clock) return null;
  return clock ? `${day} at ${clock}` : day;
}

export function nextVisitBody(input: { brand: string; address: string; date: string; time: string }): string | null {
  const when = formatNextVisit(input.date, input.time);
  if (!when) return null;
  const brand = input.brand.trim();
  const address = input.address.trim();
  if (!brand || !address) return null;
  return `${brand} here. Today's work at ${address} is done. We'll be back on ${when} to continue. See you then, thanks! - ${brand}`;
}

export function nextVisitSms(input: { name: string; brand: string; address: string; date: string; time: string }): string | null {
  const body = nextVisitBody(input);
  if (!body) return null;
  const name = input.name.trim();
  return `${name ? `Hi ${name},` : "Hi,"} ${body}`;
}

export function parseLeaveNext(raw: string | null): LeaveNext | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return null;
    const jobId = typeof value.jobId === "string" ? value.jobId.trim().slice(0, 120) : "";
    const date = typeof value.date === "string" && melbourneDay(value.date) ? value.date.trim() : "";
    const time = typeof value.time === "string" && wallTime(value.time) ? value.time.trim() : "";
    if (!jobId || !date) return null;
    return { jobId, date, time };
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

export function readLeaveNext(): string {
  try {
    const raw = store()?.getItem(leaveNextKey);
    return raw && raw.length > 0 ? raw : "\0";
  } catch {
    return "\0";
  }
}

export function writeLeaveNext(next: LeaveNext): void {
  const memory = store();
  if (!memory) return;
  try {
    if (!next.date && !next.time) {
      memory.removeItem(leaveNextKey);
      return;
    }
    memory.setItem(leaveNextKey, JSON.stringify(next));
  } catch {
    // A blocked store must not stop the SMS preview.
  }
}

export function clearLeaveNext(): void {
  try {
    store()?.removeItem(leaveNextKey);
  } catch {
    // Ignore a blocked store.
  }
}

export const departArrivalKey = "oro.jobs.depart.arrival";

export type DepartArrival = {
  jobId: string;
  time: string;
};

export function formatArrivalTime(value: string): string | null {
  return wallTime(value);
}

export function arrivalBody(input: { brand: string; address: string; visit: string; time: string }): string | null {
  const clock = wallTime(input.time);
  if (!clock) return null;
  const brand = input.brand.trim();
  const address = input.address.trim();
  if (!brand || !address) return null;
  const again = Number(input.visit) >= 2;
  if (again) {
    return `${brand} here. We're on our way back to ${address} and should be there around ${clock} to continue the job. See you soon. Thanks! - ${brand}`;
  }
  return `${brand} here. We're on our way to ${address} and should be there around ${clock}. Thanks! - ${brand}`;
}

export function arrivalSms(input: { name: string; brand: string; address: string; visit: string; time: string }): string | null {
  const body = arrivalBody(input);
  if (!body) return null;
  const name = input.name.trim();
  return `${name ? `Hi ${name},` : "Hi,"} ${body}`;
}

export function parseDepartArrival(raw: string | null): DepartArrival | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return null;
    const jobId = typeof value.jobId === "string" ? value.jobId.trim().slice(0, 120) : "";
    const time = typeof value.time === "string" && wallTime(value.time) ? value.time.trim() : "";
    if (!jobId || !time) return null;
    return { jobId, time };
  } catch {
    return null;
  }
}

export function readDepartArrival(): string {
  try {
    const raw = store()?.getItem(departArrivalKey);
    return raw && raw.length > 0 ? raw : "\0";
  } catch {
    return "\0";
  }
}

export function writeDepartArrival(arrival: DepartArrival): void {
  const memory = store();
  if (!memory) return;
  try {
    if (!arrival.time) {
      memory.removeItem(departArrivalKey);
      return;
    }
    memory.setItem(departArrivalKey, JSON.stringify({ jobId: arrival.jobId, time: arrival.time }));
  } catch {
    // A blocked store must not stop the SMS preview.
  }
}
