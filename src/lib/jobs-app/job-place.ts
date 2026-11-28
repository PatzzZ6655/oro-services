/**
 * New-job address and title. This does not rewrite jobs already in Notion.
 * Street text stays as written. The suburb is Title Case, and the state and
 * postcode are left off. A title is filled only when the property manager
 * (or, failing that, the customer) has a clear first name that is not the tenant.
 */

const stateWord = "VIC|NSW|QLD|SA|WA|TAS|NT|ACT";

function titleCasePlace(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function withoutStateAndPostcode(value: string): string {
  return value
    .replace(new RegExp(`\\b(?:${stateWord})\\b`, "gi"), " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalisePropertyAddress(raw: string): string {
  const cleaned = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned
    .split(",")
    .map((part) => withoutStateAndPostcode(part))
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]}, ${titleCasePlace(parts[1]!)}`;
}

function shortFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (!/^[A-Za-z][A-Za-z'-]{1,20}$/.test(first)) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function jobTitleName(input: { pmName: string; customerName?: string; tenantName?: string }): string {
  const pm = shortFirstName(input.pmName);
  if (pm) return pm;
  const customer = (input.customerName ?? "").trim();
  const tenant = (input.tenantName ?? "").trim();
  if (!customer || customer.toLocaleLowerCase() === tenant.toLocaleLowerCase()) return "";
  return shortFirstName(customer);
}

/** Blank when the work order does not name a manager and a suburb. */
export function confidentJobTitle(input: {
  pmName: string;
  customerName?: string;
  tenantName?: string;
  address: string;
  description: string;
}): string {
  const name = jobTitleName(input);
  const address = normalisePropertyAddress(input.address);
  const description = input.description.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (!name || !description || !address.includes(",")) return "";
  return `${name}_ ${address} _${description}`;
}
