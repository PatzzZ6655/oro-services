import { smsReplyBrands, type SmsReplyBrand } from "@/lib/sms-reply-client";

/**
 * Saved SMS phrases. Edit the Chinese label, the intent, and the English here.
 * Placeholders: {name} {address} {day} {time} {brand}
 * A blank name becomes "tenant". A blank day or time is left out of the sentence.
 */
export const smsTemplates = [
  {
    id: "first-booking",
    label: "第一次约时间",
    intent: "第一次约时间",
    english: "Hi {name}, {brand} here. We can come to {address} on {day} at {time}. Does that suit? Thanks! - {brand}",
  },
  {
    id: "second-follow-up",
    label: "第二次约时间/再次确认",
    intent: "第二次约时间，还没回复，再确认一次",
    english: "Hi {name}, {brand} here. Just checking again, as I haven't heard back. We can still come to {address} on {day} at {time}. Let me know, thanks! - {brand}",
  },
  {
    id: "collect-keys",
    label: "去办公室取钥匙",
    intent: "去办公室取钥匙",
    english: "Hi {name}, {brand} here. We'll pick the keys up from the office for {address} on {day} at {time}. Thanks! - {brand}",
  },
  {
    id: "return-keys",
    label: "还钥匙",
    intent: "还钥匙",
    english: "Hi {name}, {brand} here. The keys for {address} are back at the office. Thanks! - {brand}",
  },
  {
    id: "tomorrow-reminder",
    label: "明天到达提醒",
    intent: "明天到达提醒",
    english: "Hi {name}, {brand} here. Just a reminder we'll be at {address} tomorrow at {time}. See you then, thanks! - {brand}",
  },
  {
    id: "reschedule",
    label: "改期",
    intent: "改期",
    english: "Hi {name}, {brand} here. We need to move the visit at {address} to {day} at {time}. Sorry about the change. Thanks! - {brand}",
  },
] as const;

export type SmsTemplateId = (typeof smsTemplates)[number]["id"];

export type SmsTemplateFields = {
  name: string;
  address: string;
  day: string;
  time: string;
  brand: string;
};

export function smsTemplateById(id: string) {
  return smsTemplates.find((template) => template.id === id) ?? null;
}

export function templateBrand(brand: SmsReplyBrand | ""): string {
  return brand ? smsReplyBrands[brand] : "";
}

function whenWords(day: string, time: string, lead: "on" | "to"): string {
  if (day && time) return ` ${lead} ${day} at ${time}`;
  if (day) return ` ${lead} ${day}`;
  if (time) return lead === "on" ? ` at ${time}` : ` ${lead} ${time}`;
  return "";
}

function tidyTemplate(text: string, brand: string): string {
  const tidied = text
    .replace(brand ? /$^/ : /,\s+here\b/g, "")
    .replace(brand ? /$^/ : /\s+-\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!])/g, "$1")
    .trim();
  return tidied;
}

/** Fill a template. A blank name is "tenant". Empty day and time drop out of the sentence. */
export function fillSmsTemplate(english: string, fields: SmsTemplateFields): string {
  const name = fields.name.trim() || "tenant";
  const address = fields.address.trim() || "your place";
  const brand = fields.brand.trim();
  const day = fields.day.trim();
  const time = fields.time.trim();
  const text = english
    .replace(/ on \{day\} at \{time\}/g, whenWords(day, time, "on"))
    .replace(/ to \{day\} at \{time\}/g, whenWords(day, time, "to"))
    .replace(/ at \{time\}/g, time ? ` at ${time}` : "")
    .replace(/\{name\}/g, name)
    .replace(/\{address\}/g, address)
    .replace(/\{brand\}/g, brand)
    .replace(/\{day\}/g, day)
    .replace(/\{time\}/g, time);
  return tidyTemplate(text, brand);
}
