import { shortAddress } from "@/lib/jobs-app/address";

export type VCardInput = {
  name: string;
  phone: string;
  address: string;
  jobTitle: string;
  jobId: string;
};

function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\n|\r/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export function contactDisplayName(name: string, address: string): string {
  const person = name.trim() || "租客";
  const place = shortAddress(address);
  if (!place) return person;
  return `${person} · ${place}`;
}

export function buildVCard(input: VCardInput): string {
  const display = contactDisplayName(input.name, input.address);
  const note = `工单：${input.jobTitle.trim()}\nJob ID：${input.jobId.trim()}`;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN;CHARSET=UTF-8:${escapeVCard(display)}`,
    `N;CHARSET=UTF-8:;${escapeVCard(display)};;;`,
    `TEL;TYPE=CELL:${input.phone.trim()}`,
    `ADR;TYPE=HOME;CHARSET=UTF-8:;;${escapeVCard(input.address.trim())};;;;`,
    `NOTE;CHARSET=UTF-8:${escapeVCard(note)}`,
    "END:VCARD",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function buildVCardFile(inputs: VCardInput[]): string {
  return inputs.map((input) => buildVCard(input)).join("");
}
