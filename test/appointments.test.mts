import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addCalendarDays,
  appointmentBounds,
  appointmentCount,
  differentDatesMessage,
  isWeekendDate,
  melbourneToday,
  preferredArrivalHelp,
  preferredTimesText,
  tooManyAppointmentsMessage,
  validateAppointmentForm,
  validateAppointments,
  windowsForDate,
  weekdayWindows,
  weekendWindows,
  type AppointmentChoice,
} from "../src/lib/appointments";
import { enquiryMailto, enquiryText, parseEnquiry } from "../src/lib/enquiry";

const now = new Date("2026-11-11T01:00:00.000Z");

function firstDate(start: string, end: string, weekend: boolean): string {
  let date = start;
  while (date <= end) {
    if (isWeekendDate(date) === weekend) return date;
    date = addCalendarDays(date, 1);
  }
  throw new Error(`No ${weekend ? "weekend" : "weekday"} date between ${start} and ${end}.`);
}

function slot(date: string, windowId = windowsForDate(date)[0]?.id ?? "") {
  return { date, windowId };
}

function twoDistinctOptions(clock = now) {
  const bounds = appointmentBounds(clock);
  const weekday = firstDate(bounds.min, bounds.max, false);
  const weekend = firstDate(addCalendarDays(weekday, 1), bounds.max, true);
  return [slot(weekday), slot(weekend)];
}

function formWith(options: Array<{ date: string; windowId: string }>, extra?: { key: string; value: string }) {
  const data = new FormData();
  options.forEach((option, index) => {
    const number = index + 1;
    data.set(`option${number}Date`, option.date);
    data.set(`option${number}Window`, option.windowId);
  });
  if (extra) data.set(extra.key, extra.value);
  return data;
}

function emporoEnquiry(options: Array<{ date: string; windowId: string }>, extra?: { key: string; value: string }) {
  const data = formWith(options, extra);
  data.set("name", "Alex Customer");
  data.set("email", "alex@example.com");
  data.set("phone", "0400000000");
  data.set("suburb", "Richmond");
  data.set("brand", "emporo");
  data.set("service", "plumbing");
  data.set("description", "Kitchen sink is leaking under the cupboard.");
  return data;
}

test("appointment copy asks for two options", () => {
  assert.equal(appointmentCount, 2);
  assert.equal(
    preferredArrivalHelp,
    "Choose two different days and an arrival window for each. We'll confirm one of them with you. Our plumber will arrive within the window you pick.",
  );
  assert.equal(differentDatesMessage, "Choose two different dates.");
  assert.equal(tooManyAppointmentsMessage, "Choose two preferred options.");
  assert.equal(weekdayWindows.map((window) => window.label).join(", "), "8–10am, 11am–1pm, 2–4pm, 5–7pm");
  assert.equal(weekendWindows.map((window) => window.label).join(", "), "9–11am, 12–2pm, 3–5pm");
});

test("the form, client check, and server check share the two-option rule", () => {
  const form = readFileSync(new URL("../src/components/enquiry-form.tsx", import.meta.url), "utf8");
  const fields = readFileSync(new URL("../src/components/appointment-fields.tsx", import.meta.url), "utf8");
  const enquiry = readFileSync(new URL("../src/lib/enquiry.ts", import.meta.url), "utf8");
  assert.match(form, /validateAppointmentForm/);
  assert.match(enquiry, /validateAppointmentForm/);
  assert.match(fields, /appointmentCount/);
  assert.match(fields, /preferredArrivalHelp/);
  assert.doesNotMatch(form, /\[1,\s*2,\s*3\]/);
  assert.doesNotMatch(enquiry, /\[1,\s*2,\s*3\]/);
  assert.doesNotMatch(`${form}\n${fields}\n${enquiry}`, /\bthree\b/i);
});

test("client and direct validation accept two distinct options", () => {
  const options = twoDistinctOptions();
  const direct = validateAppointments(options, now);
  const client = validateAppointmentForm(formWith(options), now);
  assert.equal(direct.ok, true);
  assert.equal(client.ok, true);
  if (!direct.ok || !client.ok) return;
  assert.equal(direct.value.length, 2);
  assert.deepEqual(
    client.value.map((choice) => choice.date),
    direct.value.map((choice) => choice.date),
  );
  assert.deepEqual(
    direct.value.map((choice) => choice.windowLabel),
    options.map((option) => windowsForDate(option.date).find((window) => window.id === option.windowId)?.label),
  );
});

test("validation rejects fewer than two options", () => {
  const [only] = twoDistinctOptions();
  const missingSecond = validateAppointments([only], now);
  const blankSecond = validateAppointmentForm(formWith([only, { date: "", windowId: "" }]), now);
  assert.equal(missingSecond.ok, false);
  assert.equal(blankSecond.ok, false);
  if (missingSecond.ok || blankSecond.ok) return;
  assert.equal(missingSecond.errors.option2Date, "Choose a date for preferred option 2.");
  assert.equal(missingSecond.errors.option2Window, "Choose an arrival window for preferred option 2.");
  assert.equal(blankSecond.errors.option2Date, "Choose a date for preferred option 2.");
});

test("validation rejects more than two options", () => {
  const options = twoDistinctOptions();
  const bounds = appointmentBounds(now);
  const thirdDate = firstDate(addCalendarDays(options[1].date, 1), bounds.max, false);
  const three = [...options, slot(thirdDate)];
  const direct = validateAppointments(three, now);
  const client = validateAppointmentForm(
    formWith(options, { key: "option3Date", value: thirdDate }),
    now,
  );
  assert.equal(direct.ok, false);
  assert.equal(client.ok, false);
  if (direct.ok || client.ok) return;
  assert.equal(direct.errors.options, tooManyAppointmentsMessage);
  assert.equal(client.errors.options, tooManyAppointmentsMessage);
});

test("validation rejects two options on the same date", () => {
  const [first] = twoDistinctOptions();
  const sameDate = [first, { date: first.date, windowId: windowsForDate(first.date)[1].id }];
  const direct = validateAppointments(sameDate, now);
  const client = validateAppointmentForm(formWith(sameDate), now);
  assert.equal(direct.ok, false);
  assert.equal(client.ok, false);
  if (direct.ok || client.ok) return;
  assert.equal(direct.errors.options, differentDatesMessage);
  assert.equal(client.errors.options, differentDatesMessage);
});

test("dates must be from tomorrow through 60 days, with the window for that day", () => {
  const bounds = appointmentBounds(now);
  const [first, second] = twoDistinctOptions();
  const today = melbourneToday(now);
  assert.equal(bounds.min, addCalendarDays(today, 1));
  assert.equal(bounds.max, addCalendarDays(today, 60));

  const todayResult = validateAppointments([slot(today), second], now);
  const beyondResult = validateAppointments([first, slot(addCalendarDays(bounds.max, 1))], now);
  const edgeResult = validateAppointments([first, slot(bounds.max)], now);
  const wrongWindow = validateAppointments(
    [first, { date: second.date, windowId: isWeekendDate(second.date) ? "8-10am" : "9-11am" }],
    now,
  );

  assert.equal(todayResult.ok, false);
  assert.equal(beyondResult.ok, false);
  assert.equal(edgeResult.ok, true);
  assert.equal(wrongWindow.ok, false);
  if (todayResult.ok || beyondResult.ok || wrongWindow.ok) return;
  assert.equal(todayResult.errors.option1Date, "Choose a date from tomorrow, within the next 60 days.");
  assert.equal(beyondResult.errors.option2Date, "Choose a date from tomorrow, within the next 60 days.");
  assert.equal(wrongWindow.errors.option2Window, "Choose an arrival window for that day.");
});

test("server accepts two Emporo options and emails both", () => {
  const options = twoDistinctOptions(new Date());
  const parsed = parseEnquiry(emporoEnquiry(options));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const choices = parsed.value.appointments;
  assert.equal(choices?.length, 2);
  const text = enquiryText(parsed.value);
  const body = decodeURIComponent(enquiryMailto(parsed.value).split("body=")[1] ?? "");
  const preferredLines = text.split("\n").filter((line) => /^\d+\)/.test(line));
  assert.equal(preferredLines.length, 2);
  assert.match(text, /Preferred times:/);
  assert.equal(text.includes("3)"), false);
  assert.match(body, /Preferred times:/);
  assert.equal(body.includes("3)"), false);
  assert.equal(preferredTimesText(choices as AppointmentChoice[]), ["Preferred times:", ...preferredLines].join("\n"));
});

test("server rejects one option, three options, and a repeated date", () => {
  const options = twoDistinctOptions(new Date());
  const bounds = appointmentBounds();
  const thirdDate = firstDate(addCalendarDays(options[1].date, 1), bounds.max, !isWeekendDate(options[1].date));
  const one = parseEnquiry(emporoEnquiry([options[0]]));
  const three = parseEnquiry(emporoEnquiry(options, { key: "option3Window", value: windowsForDate(thirdDate)[0].id }));
  const repeated = parseEnquiry(
    emporoEnquiry([options[0], { date: options[0].date, windowId: windowsForDate(options[0].date)[1].id }]),
  );

  assert.equal(one.ok, false);
  assert.equal(three.ok, false);
  assert.equal(repeated.ok, false);
  if (one.ok || three.ok || repeated.ok) return;
  assert.equal(one.errors.option2Date, "Choose a date for preferred option 2.");
  assert.equal(three.errors.options, tooManyAppointmentsMessage);
  assert.equal(repeated.errors.options, differentDatesMessage);
});

test("blank extra option fields do not count as a third choice", () => {
  const options = twoDistinctOptions(new Date());
  const parsed = parseEnquiry(emporoEnquiry(options, { key: "option3Date", value: "   " }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.appointments?.length, 2);
});

test("Emoro enquiries do not ask for appointment options", () => {
  const data = new FormData();
  data.set("name", "Alex Customer");
  data.set("email", "alex@example.com");
  data.set("suburb", "Richmond");
  data.set("brand", "emoro");
  data.set("service", "general-construction");
  data.set("description", "We need a small shop fit-out quoted.");
  const parsed = parseEnquiry(data);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.appointments, undefined);
  assert.equal(enquiryText(parsed.value).includes("Preferred times:"), false);
});
