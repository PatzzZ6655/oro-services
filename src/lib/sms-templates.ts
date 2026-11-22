/**
 * SMS templates Pat can edit in this one file.
 * Placeholders use square brackets. A blank [Name] becomes "tenant".
 * Anything else that cannot be filled is removed, and brackets never stay in the text.
 */

export const smsTemplateGroups = ["约时间", "到场", "钥匙·物业", "特殊"] as const;

export type SmsTemplateGroup = (typeof smsTemplateGroups)[number];
export type SmsAudience = "tenant" | "pm";

export type SmsTemplateVariant = {
  id: string;
  label: string;
  english: string;
};

export type SmsTemplate = {
  id: string;
  label: string;
  group: SmsTemplateGroup;
  audience: SmsAudience;
  intent: string;
  english?: string;
  variants?: SmsTemplateVariant[];
};

export const smsTemplates: SmsTemplate[] = [
  {
    id: "first-visit",
    label: "首次约时间",
    group: "约时间",
    audience: "tenant",
    intent: "首次约时间",
    english:
      "Hi [Name], Pat from [Brand] here. We've got a work order from [Agency] for [Address]. When suits you for us to come by? Happy to work around you, including after 5pm or weekends. Thanks!",
  },
  {
    id: "follow-up",
    label: "跟进没回复",
    group: "约时间",
    audience: "tenant",
    intent: "跟进没回复",
    english:
      "Hi [Name], Pat from [Brand] again. Just following up on the repair at [Address]. Sorry if I've called a few times. When's a good time to come by? Thanks!",
  },
  {
    id: "confirm",
    label: "确认预约",
    group: "约时间",
    audience: "tenant",
    intent: "确认预约",
    english:
      "Hi [Name], confirming we'll be at [Address] on [Day Date] around [Time]. Please reply YES, or let me know if another time suits better. Thanks, Pat – [Brand]",
  },
  {
    id: "arrival",
    label: "到场提醒",
    group: "到场",
    audience: "tenant",
    intent: "到场提醒",
    variants: [
      { id: "today", label: "今天到", english: "Hi [Name], Pat here. We'll be there today around [Time]. See you soon!" },
      { id: "enroute", label: "在路上", english: "Hi [Name], Pat here. I'm on my way, about [xx] mins away. See you soon!" },
    ],
  },
  {
    id: "reschedule",
    label: "改期",
    group: "约时间",
    audience: "tenant",
    intent: "改期",
    english:
      "Hi [Name], sorry for the short notice. We can't make it today as [Reason]. Could we come [Day] instead: morning, early afternoon, or after 4pm? Sorry again and thanks for your patience! Pat – [Brand]",
  },
  {
    id: "return-finish",
    label: "回来继续",
    group: "约时间",
    audience: "tenant",
    intent: "回来继续",
    english: "Hi [Name], we'll be back on [Day Date] around [Time] to finish the job at [Address]. Thanks for your patience! Pat – [Brand]",
  },
  {
    id: "rental-law",
    label: "法规说明",
    group: "特殊",
    audience: "tenant",
    intent: "法规说明",
    english: "Hi [Name], this is required under the new Victorian rental laws, so the owner needs to have it fixed. Thanks for understanding.",
  },
  {
    id: "keys",
    label: "钥匙",
    group: "钥匙·物业",
    audience: "pm",
    intent: "钥匙",
    variants: [
      { id: "collect", label: "取", english: "Hi [PM Name], when's a good time to pick up the keys for [Address]? Thanks, Pat – [Brand]" },
      { id: "return", label: "还", english: "Hi [PM Name], the job at [Address] is complete and the keys are back at your office. Thanks, Pat – [Brand]" },
    ],
  },
  {
    id: "cant-reach",
    label: "联系不上租客",
    group: "钥匙·物业",
    audience: "pm",
    intent: "联系不上租客",
    english:
      "Hi [PM Name], quick update on [Address]. I've tried the tenant a few times with no luck. Could you help me get in touch with them? Keen to get it done ASAP. Cheers, Pat – [Brand]",
  },
  {
    id: "emergency",
    label: "紧急报修",
    group: "钥匙·物业",
    audience: "pm",
    intent: "紧急报修",
    english:
      "Hi [PM Name], got your request about the emergency at [Address]. I can attend [Time]. In the meantime, if it's a [water/gas] issue, please ask the tenant to turn off the main. I'll update you once I'm on site. Thanks, Pat – [Brand]",
  },
];

export type SmsTemplateFields = {
  name: string;
  pmName: string;
  brand: string;
  agency: string;
  address: string;
  day: string;
  time: string;
  mins: string;
  reason: string;
  issue: string;
};

export function smsTemplateById(id: string): SmsTemplate | null {
  return smsTemplates.find((template) => template.id === id) ?? null;
}

export function templateEnglish(template: SmsTemplate, variant: string): string {
  if (!template.variants?.length) return template.english ?? "";
  return template.variants.find((item) => item.id === variant)?.english ?? template.variants[0]?.english ?? "";
}

export function defaultVariant(template: SmsTemplate): string {
  return template.variants?.[0]?.id ?? "";
}

const dateChips = [
  { key: "today", label: "今天" },
  { key: "tomorrow", label: "明天" },
  { key: "mon", label: "周一", weekday: 1 },
  { key: "tue", label: "周二", weekday: 2 },
  { key: "wed", label: "周三", weekday: 3 },
  { key: "thu", label: "周四", weekday: 4 },
  { key: "fri", label: "周五", weekday: 5 },
  { key: "sat", label: "周六", weekday: 6 },
  { key: "sun", label: "周日", weekday: 0 },
] as const;

export const smsDateChips = dateChips.map((chip) => ({ key: chip.key, label: chip.label }));
export const smsTimeChips = ["8am", "9am", "10am", "1pm", "2pm", "after 4pm"] as const;
export const smsMinuteChips = ["15", "30", "45", "60"] as const;

export type SmsDateChip = (typeof dateChips)[number]["key"];

type Ymd = { year: number; month: number; day: number };

function melbourneParts(date: Date): Ymd & { weekday: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { year, month, day, weekday };
}

function addDays(ymd: Ymd, days: number): Ymd {
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days, 12));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function sameDay(a: Ymd, b: Ymd): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Day plus date, for example Tue 25/11. */
export function formatVisitDate(ymd: Ymd): string {
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12));
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "numeric",
    month: "2-digit",
  }).formatToParts(utc);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${weekday} ${day}/${month}`;
}

export function dateFromChip(key: string, now = new Date()): string {
  const today = melbourneParts(now);
  if (key === "today") return formatVisitDate(today);
  if (key === "tomorrow") return formatVisitDate(addDays(today, 1));
  const chip = dateChips.find((item) => item.key === key);
  if (!chip || !("weekday" in chip)) return "";
  const target = chip.weekday;
  const delta = (target - today.weekday + 7) % 7;
  return formatVisitDate(addDays(today, delta));
}

function clockLabel(hour: number, minute: number): string {
  if (minute === 0 && hour === 8) return "8am";
  if (minute === 0 && hour === 9) return "9am";
  if (minute === 0 && hour === 10) return "10am";
  if (minute === 0 && hour === 13) return "1pm";
  if (minute === 0 && hour === 14) return "2pm";
  if (hour >= 16 && hour < 20) return "after 4pm";
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return minute === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minute).padStart(2, "0")}${suffix}`;
}

export type JobSchedule = { dateKey: string; dateLabel: string; time: string };

/** Read a Notion scheduled value. Returns null when it is not a date. */
export function scheduleFromJob(scheduled: string, now = new Date()): JobSchedule | null {
  const match = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(scheduled.trim());
  if (!match) return null;
  const ymd = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const today = melbourneParts(now);
  const tomorrow = addDays(today, 1);
  let dateKey = "";
  if (sameDay(ymd, today)) dateKey = "today";
  else if (sameDay(ymd, tomorrow)) dateKey = "tomorrow";
  else {
    const weekday = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12)).getUTCDay();
    const chip = dateChips.find((item) => "weekday" in item && item.weekday === weekday);
    const upcoming = chip ? dateFromChip(chip.key, now) : "";
    if (chip && upcoming === formatVisitDate(ymd)) dateKey = chip.key;
  }
  const time = match[4] && match[5] ? clockLabel(Number(match[4]), Number(match[5])) : "";
  return { dateKey, dateLabel: formatVisitDate(ymd), time };
}

export type SmsSuggestion = { id: string; variant: string };

/** Two or three templates for the job's current stage. */
export function suggestTemplates(status: string): SmsSuggestion[] {
  const text = status.trim().toLowerCase();
  if (/complete|completed|done|finished|closed|完工/.test(text)) {
    return [
      { id: "keys", variant: "return" },
      { id: "return-finish", variant: "" },
    ];
  }
  if (/on the way|en route|depart|travelling|出发/.test(text)) {
    return [
      { id: "arrival", variant: "enroute" },
      { id: "confirm", variant: "" },
    ];
  }
  if (/book|confirm|scheduled|预约/.test(text)) {
    return [
      { id: "confirm", variant: "" },
      { id: "arrival", variant: "today" },
      { id: "keys", variant: "collect" },
    ];
  }
  return [
    { id: "first-visit", variant: "" },
    { id: "follow-up", variant: "" },
    { id: "cant-reach", variant: "" },
  ];
}

const pickCues: Array<{ id: string; variant: string; words: string[] }> = [
  { id: "arrival", variant: "enroute", words: ["在路上", "马上到", "分钟"] },
  { id: "keys", variant: "return", words: ["还钥匙", "钥匙还了", "钥匙送回"] },
  { id: "keys", variant: "collect", words: ["取钥匙", "拿钥匙"] },
  { id: "emergency", variant: "", words: ["紧急", "急修", "漏水", "煤气"] },
  { id: "cant-reach", variant: "", words: ["联系不上", "没联系上", "租客不回"] },
  { id: "rental-law", variant: "", words: ["法规", "法律", "维多利亚"] },
  { id: "reschedule", variant: "", words: ["改期", "改天", "去不了"] },
  { id: "return-finish", variant: "", words: ["回来", "继续做", "收尾"] },
  { id: "arrival", variant: "today", words: ["到场", "今天到", "提醒"] },
  { id: "confirm", variant: "", words: ["确认", "预约"] },
  { id: "follow-up", variant: "", words: ["没回复", "跟进"] },
  { id: "first-visit", variant: "", words: ["首次", "工单", "约时间", "第一次"] },
];

export function matchSmsTemplate(intent: string): SmsSuggestion | null {
  const text = intent.trim();
  if (!text) return null;
  for (const cue of pickCues) {
    if (cue.words.some((word) => text.includes(word))) return { id: cue.id, variant: cue.variant };
  }
  return null;
}

function minutesOfClock(label: string): number | null {
  if (label === "after 4pm") return 16 * 60;
  const match = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/i.exec(label.replace(/\s+/g, ""));
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = match[3]!.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function intentClock(intent: string): { label: string; minutes: number } | null {
  const pm = /下午\s*(\d{1,2})\s*点?/.exec(intent);
  if (pm) {
    const hour = Number(pm[1]) % 12 + 12;
    return { label: `${Number(pm[1])}pm`, minutes: hour * 60 };
  }
  const am = /上午\s*(\d{1,2})\s*点?/.exec(intent);
  if (am) {
    const hour = Number(am[1]) % 12;
    return { label: `${Number(am[1])}am`, minutes: hour * 60 };
  }
  const clock = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(intent);
  if (clock) {
    const label = `${clock[1]}${clock[2] ? `:${clock[2]}` : ""}${clock[3]!.toLowerCase()}`;
    const minutes = minutesOfClock(label.replace(":", clock[2] ? ":" : ""));
    return minutes === null ? null : { label, minutes };
  }
  const point = /(\d{1,2})\s*点/.exec(intent);
  if (point) {
    const hour = Number(point[1]);
    return { label: `${hour}点`, minutes: hour * 60 };
  }
  return null;
}

/** A warning when the Chinese note names a different day or time from the buttons. */
export function scheduleConflict(intent: string, selected: { dateKey: string; time: string }): string {
  const notes: string[] = [];
  if (/今天/.test(intent) && selected.dateKey && selected.dateKey !== "today") notes.push("the note says today");
  if (/明天/.test(intent) && selected.dateKey && selected.dateKey !== "tomorrow") notes.push("the note says tomorrow");
  const clock = intentClock(intent);
  const chosen = minutesOfClock(selected.time);
  if (clock && chosen !== null && Math.abs(clock.minutes - chosen) > 30) notes.push(`the note says ${clock.label}`);
  if (notes.length === 0) return "";
  return `Check the time. ${notes.join(", ")} but the buttons say ${selected.time || "another time"}.`;
}

export type DraftPart = { text: string; mark: boolean };

const highlightPattern =
  /(\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\/\d{2}\b|\bafter 4pm\b|\babout \d+ mins\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/gi;

export function highlightSchedule(text: string): DraftPart[] {
  const parts: DraftPart[] = [];
  let last = 0;
  for (const match of text.matchAll(highlightPattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), mark: false });
    parts.push({ text: match[0], mark: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return parts.length > 0 ? parts : [{ text, mark: false }];
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/Hi\s+,/g, "Hi,")
    .replace(/\s+–\s*(?=[.!]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fill one template. Empty optional details are removed so no brackets remain. */
export function fillSmsTemplate(english: string, fields: SmsTemplateFields): string {
  const name = fields.name.trim() || "tenant";
  const pm = fields.pmName.trim();
  const brand = fields.brand.trim();
  const agency = fields.agency.trim();
  const address = fields.address.trim();
  const day = fields.day.trim();
  const time = fields.time.trim();
  const mins = fields.mins.trim();
  const reason = fields.reason.trim();
  const issue = fields.issue.trim();
  let text = english.replace(/\[Name\]/g, name);
  text = pm ? text.replace(/\[PM Name\]/g, pm) : text.replace(/\[PM Name\]/g, "");
  text = brand ? text.replace(/\[Brand\]/g, brand) : text.replace(/ from \[Brand\]/g, "").replace(/ – \[Brand\]/g, "");
  text = agency ? text.replace(/\[Agency\]/g, agency) : text.replace(/ from \[Agency\]/g, "");
  text = address
    ? text.replace(/\[Address\]/g, address)
    : text.replace(/ about the emergency at \[Address\]/g, "").replace(/ for \[Address\]/g, "").replace(/ at \[Address\]/g, "").replace(/ on \[Address\]/g, "");
  text = day ? text.replace(/\[Day Date\]/g, day).replace(/\[Day\]/g, day) : text.replace(/ on \[Day Date\]/g, "").replace(/ \[Day\]/g, "");
  text = time ? text.replace(/\[Time\]/g, time) : text.replace(/ around \[Time\]/g, "").replace(/ \[Time\]/g, "");
  text = mins ? text.replace(/\[xx\]/g, mins) : text.replace(/, about \[xx\] mins away/g, "");
  text = reason ? text.replace(/\[Reason\]/g, reason) : text.replace(/ as \[Reason\]/g, "");
  text = issue ? text.replace(/\[water\/gas\]/g, issue) : text.replace(/ if it's a \[water\/gas\] issue,/g, "");
  text = text.replace(/\[[^\]]+\]/g, "");
  return tidy(text);
}
