import { normalizePhone } from "@/lib/jobs-app/phones";

/**
 * iOS Messages links.
 *
 * One ticked recipient uses a normal single-number link. iOS wants an
 * ampersand before the body, not `?body=`:
 *   sms:+61412345678&body=<urlencoded>
 *
 * Two or more open one group compose, so replies for that house stay in one
 * thread. The form this app uses (the one requested for iOS) is:
 *   sms:/open?addresses=+61411,+61422&body=<urlencoded>
 * Addresses keep a literal "+" and commas. Only the body is percent-encoded.
 *
 * If that sheet does not open, the screen also offers the older comma form:
 *   sms:+61411,+61422&body=<urlencoded>
 *
 * The shared body keeps the Make wording after the greeting. A leading
 * single-person greeting is replaced:
 * - 1 name: "Hi Sam,"
 * - 2 names: "Hi Sam and Lee,"
 * - 3 or 4 names: "Hi Sam, Lee and Jo,"
 * - 5+ names, or several people with no name: "Hi all,"
 * - one person and no name: "Hi,"
 */
export function groupGreeting(names: string[], recipientCount: number): string {
  const clean: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  if (clean.length === 0) return recipientCount > 1 ? "Hi all," : "Hi,";
  if (clean.length === 1) return `Hi ${clean[0]},`;
  if (clean.length === 2) return `Hi ${clean[0]} and ${clean[1]},`;
  if (clean.length <= 4) return `Hi ${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]},`;
  return "Hi all,";
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripGreeting(source: string, names: string[] = []): string {
  const trimmed = source.trim();
  const comma = /^(?:hi|hello|hey|dear)\s+([^,\n!]{1,80}),\s*([\s\S]*)$/i.exec(trimmed);
  if (comma?.[1] && comma[1].trim().length <= 60) return (comma[2] ?? "").trim();

  const named = names.map((name) => name.trim()).filter(Boolean);
  if (named.length > 0) {
    const pattern = named.map((name) => escapeName(name)).join("|");
    const specific = new RegExp(`^(?:hi|hello|hey|dear)\\s+(?:${pattern})\\b\\s*[,!]?\\s*`, "i").exec(trimmed);
    if (specific) return trimmed.slice(specific[0].length).trim();
  }

  const excited = /^(?:hi|hello|hey|dear)\s+([^!\n]{1,40})!\s*([\s\S]*)$/i.exec(trimmed);
  if (excited?.[1] && !excited[1].includes(",")) return (excited[2] ?? "").trim();

  const chinese = /^(?:你好|您好)[，,]?\s*([^，,\n]{0,40}?)[，,]\s*([\s\S]*)$/.exec(trimmed);
  if (chinese) return (chinese[2] ?? "").trim();
  return trimmed;
}

export function messageBody(source: string, names: string[], recipientCount: number): string {
  const rest = stripGreeting(source, names);
  const greeting = groupGreeting(names, recipientCount);
  if (!rest) return greeting;
  return `${greeting} ${rest}`;
}

export type SmsContact = { name: string; phone: string; sms: string };

export function sharedSms(topSms: string, contacts: SmsContact[], tickedPhones: string[]): string {
  const ticked = new Set(tickedPhones.map((phone) => normalizePhone(phone)).filter((phone): phone is string => Boolean(phone)));
  const selected = contacts.filter((contact) => {
    const phone = normalizePhone(contact.phone);
    return Boolean(phone && ticked.has(phone));
  });
  const source =
    selected.find((contact) => contact.sms.trim())?.sms ??
    contacts.find((contact) => contact.sms.trim())?.sms ??
    topSms;
  if (!source.trim()) return "";
  return messageBody(source, selected.map((contact) => contact.name), selected.length);
}

export function smsHref(phones: string[], body: string): { href: string; fallback: string | null } | null {
  const list: string[] = [];
  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    if (normalized && !list.includes(normalized)) list.push(normalized);
  }
  if (list.length === 0 || !body.trim()) return null;
  const encoded = encodeURIComponent(body);
  if (list.length === 1) return { href: `sms:${list[0]}&body=${encoded}`, fallback: null };
  const joined = list.join(",");
  return {
    href: `sms:/open?addresses=${joined}&body=${encoded}`,
    fallback: `sms:${joined}&body=${encoded}`,
  };
}
