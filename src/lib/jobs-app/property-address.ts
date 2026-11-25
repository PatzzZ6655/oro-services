/**
 * A property address on a work order is the job site.
 * Agency letterhead, footers, and office contact blocks are not the job site.
 */

const knownOffices = [{ agency: "barry plant", street: "518 whitehorse", suburb: "mitcham" }];

function plain(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.…]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAbn(value: string): boolean {
  return /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/.test(value);
}

function hasPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /04\d{8}/.test(digits) || /614\d{8}/.test(digits);
}

function agencyWords(agency: string): string[] {
  return plain(agency)
    .split(" ")
    .filter((word) => word.length > 2 && !["pty", "ltd", "limited", "group", "the", "and"].includes(word));
}

export function jobPropertyAddress(address: string, context: { agency?: string } = {}): string {
  const cleaned = address.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (isAgencyOfficeAddress(cleaned, context.agency ?? "")) return "";
  return cleaned;
}

export function isAgencyOfficeAddress(address: string, agency = ""): boolean {
  const text = plain(address);
  if (!text) return false;
  if (hasAbn(address) || hasPhone(address)) return true;
  const words = agencyWords(agency);
  if (words.length >= 2 && words.every((word) => text.includes(word))) return true;
  const agencyText = plain(agency);
  for (const office of knownOffices) {
    if (!text.includes(office.street)) continue;
    if (office.suburb && !text.includes(office.suburb)) continue;
    if (!agencyText || agencyText.includes(office.agency) || office.agency.includes(agencyText)) return true;
  }
  return false;
}
