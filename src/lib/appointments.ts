export const appointmentCount = 3;

export const weekdayWindows = [
  { id: "8-10am", label: "8–10am" },
  { id: "11am-1pm", label: "11am–1pm" },
  { id: "2-4pm", label: "2–4pm" },
  { id: "5-7pm", label: "5–7pm" },
] as const;

export const weekendWindows = [
  { id: "9-11am", label: "9–11am" },
  { id: "12-2pm", label: "12–2pm" },
  { id: "3-5pm", label: "3–5pm" },
] as const;

export type ArrivalWindow = (typeof weekdayWindows)[number] | (typeof weekendWindows)[number];

export type AppointmentChoice = {
  date: string;
  windowId: string;
  windowLabel: string;
};

export type AppointmentFieldErrors = {
  options?: string;
  option1Date?: string;
  option1Window?: string;
  option2Date?: string;
  option2Window?: string;
  option3Date?: string;
  option3Window?: string;
};

const dateFields = ["option1Date", "option2Date", "option3Date"] as const;
const windowFields = ["option1Window", "option2Window", "option3Window"] as const;

export function melbourneToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function appointmentBounds(now = new Date()): { min: string; max: string } {
  const today = melbourneToday(now);
  return { min: addCalendarDays(today, 1), max: addCalendarDays(today, 60) };
}

export function isRealCalendarDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function isWeekendDate(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 1)));
  return weekday === "Sat" || weekday === "Sun";
}

export function windowsForDate(isoDate: string): readonly ArrivalWindow[] {
  if (!isRealCalendarDate(isoDate)) return [];
  return isWeekendDate(isoDate) ? weekendWindows : weekdayWindows;
}

export function formatAppointmentDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(Date.UTC(year, month - 1, day, 1)));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("weekday")} ${value("day")} ${value("month")} ${value("year")}`;
}

export function duplicateDateMessage(dates: string[]): string | undefined {
  const filled = dates.map((date) => date.trim()).filter(Boolean);
  if (new Set(filled).size !== filled.length) return "Choose three different dates.";
  return undefined;
}

export function preferredTimesText(choices: AppointmentChoice[]): string {
  const lines = choices.map(
    (choice, index) => `${index + 1}) ${formatAppointmentDate(choice.date)}, ${choice.windowLabel}`,
  );
  return ["Preferred times:", ...lines].join("\n");
}

function windowById(isoDate: string, windowId: string): ArrivalWindow | undefined {
  return windowsForDate(isoDate).find((window) => window.id === windowId);
}

export function validateAppointments(
  raw: Array<{ date: string; windowId: string }>,
  now = new Date(),
): { ok: true; value: AppointmentChoice[] } | { ok: false; errors: AppointmentFieldErrors } {
  const errors: AppointmentFieldErrors = {};
  const bounds = appointmentBounds(now);
  const choices: AppointmentChoice[] = [];

  raw.slice(0, appointmentCount).forEach((option, index) => {
    const date = option.date.trim();
    const windowId = option.windowId.trim();
    const dateField = dateFields[index];
    const windowField = windowFields[index];
    const optionNumber = index + 1;

    if (!date) {
      errors[dateField] = `Choose a date for preferred option ${optionNumber}.`;
    } else if (!isRealCalendarDate(date) || date < bounds.min || date > bounds.max) {
      errors[dateField] = "Choose a date from tomorrow, within the next 60 days.";
    }

    if (!windowId) {
      errors[windowField] = `Choose an arrival window for preferred option ${optionNumber}.`;
    } else if (date && isRealCalendarDate(date)) {
      const match = windowById(date, windowId);
      if (!match) {
        errors[windowField] = "Choose an arrival window for that day.";
      } else {
        choices[index] = { date, windowId, windowLabel: match.label };
      }
    }
  });

  const duplicate = duplicateDateMessage(raw.map((option) => option.date));
  if (duplicate) errors.options = duplicate;

  if (Object.keys(errors).length > 0 || choices.filter(Boolean).length !== appointmentCount) {
    return { ok: false, errors };
  }

  return { ok: true, value: choices };
}
