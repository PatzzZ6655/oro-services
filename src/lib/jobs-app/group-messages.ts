import { firstName } from "@/lib/jobs-app/contact-groups";
import { groupSmsTemplates, neighbourImpactLines } from "@/lib/sms-templates";

export { neighbourImpactLines };

export const jobSmsBodyLimit = 480;

export type GroupMessageFields = {
  first: string;
  brand: string;
  agency: string;
  summary: string;
  address: string;
  duration: string;
  date: string;
  time: string;
  impact: string;
};

function fill(template: string, fields: GroupMessageFields): string {
  return template
    .replaceAll("[First]", fields.first.trim() || "there")
    .replaceAll("[Brand]", fields.brand.trim())
    .replaceAll("[Agency]", fields.agency.trim())
    .replaceAll("[Summary]", fields.summary.trim())
    .replaceAll("[Address]", fields.address.trim())
    .replaceAll("[Duration]", fields.duration.trim())
    .replaceAll("[Date]", fields.date.trim())
    .replaceAll("[Time]", fields.time.trim())
    .replaceAll("[Impact]", fields.impact.trim())
    .replace(/[ ]{2,}/g, " ")
    .replace(/ +\./g, ".")
    .trim();
}

export function fieldsFor(name: string, extra: Partial<GroupMessageFields> = {}): GroupMessageFields {
  return {
    brand: "",
    agency: "",
    summary: "",
    address: "",
    duration: "",
    date: "",
    time: "",
    impact: "",
    ...extra,
    first: extra.first?.trim() || firstName(name),
  };
}

export function neighbourIntro(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.n1, fields);
}

export function neighbourFollowUp(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.neighbourFollowUp, fields);
}

export function neighbourBooked(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.n2, fields);
}

export function neighbourDateChange(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.dateChange, fields);
}

export function neighbourDone(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.n3, fields);
}

export function ownerIntro(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.o1, fields);
}

export function ownerFollowUp(fields: GroupMessageFields): string {
  return fill(groupSmsTemplates.o2, fields);
}

export function keyPickupSubject(address: string, brand: string): string {
  return `Key pickup – ${address.trim()} – ${brand.trim()}`;
}

export function keyPickupBody(pmFirst: string, address: string, pickupDate: string, brand: string): string {
  return [
    `Hi ${pmFirst.trim() || "there"},`,
    `We've been asked to attend ${address.trim()}, which we understand is vacant, so we'll need to collect the keys from your office.`,
    `We're planning to pick them up on ${pickupDate.trim()}. Would you mind having the keys ready for us? Much appreciated.`,
    "We'll return the keys to your office as soon as the works are finished.",
    "Kind regards,",
    brand.trim(),
  ].join("\n");
}

export type KeyPickupPayload = {
  mode: "sendKeyPickupEmail";
  business: string;
  jobId: string;
  address: string;
  brand: string;
  pmFirstName: string;
  pickupDate: string;
  subject: string;
  body: string;
};

export function keyPickupPayload(input: Omit<KeyPickupPayload, "mode" | "subject" | "body">): KeyPickupPayload {
  return {
    mode: "sendKeyPickupEmail",
    ...input,
    subject: keyPickupSubject(input.address, input.brand),
    body: keyPickupBody(input.pmFirstName, input.address, input.pickupDate, input.brand),
  };
}

export type GroupEmailPayload = {
  mode: "sendGroupEmail";
  business: string;
  jobId: string;
  group: "Neighbour";
  template: string;
  impactLine: string;
  address: string;
  brand: string;
  summary: string;
  date: string;
  contacts: { name: string; email: string; first: string }[];
};

export function groupEmailPayload(input: Omit<GroupEmailPayload, "mode" | "group">): GroupEmailPayload {
  return { mode: "sendGroupEmail", group: "Neighbour", ...input };
}

export type ContactSyncPayload = {
  mode: "syncContact";
  business: string;
  jobId: string;
  pageId: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  displayName: string;
};

export function contactSyncPayload(input: Omit<ContactSyncPayload, "mode">): ContactSyncPayload {
  return { mode: "syncContact", ...input };
}
