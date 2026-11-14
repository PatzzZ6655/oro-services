import { isRealCalendarDate, melbourneToday } from "@/lib/appointments";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isoFromUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addYears(isoDate: string, years: number): string | null {
  if (!isRealCalendarDate(isoDate) || !Number.isInteger(years)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year + years, month - 1, day));
  if (shifted.getUTCMonth() !== month - 1) {
    return isoFromUtc(new Date(Date.UTC(year + years, month, 0)));
  }
  return isoFromUtc(shifted);
}

export function formatAuDate(isoDate: string): string {
  if (!isRealCalendarDate(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

export function dateError(isoDate: string, now = new Date()): string | undefined {
  if (!isRealCalendarDate(isoDate)) return "Enter a date.";
  if (isoDate < "2020-01-01") return "Use a date from 2020 onwards.";
  if (isoDate > melbourneToday(now)) return "Use today or an earlier date.";
  return undefined;
}
