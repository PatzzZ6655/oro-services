import { normalisePropertyAddress } from "@/lib/jobs-app/job-place";

/** Live Contacts Select options. An empty Select is a tenant. */
export type ContactRole = "tenant" | "owner" | "neighbour" | "other";

export const contactRoles: ContactRole[] = ["tenant", "owner", "neighbour", "other"];

export function contactRole(select: string): ContactRole {
  const value = select.trim().toLowerCase();
  if (value === "owner") return "owner";
  if (value === "neighbour") return "neighbour";
  if (value === "other") return "other";
  return "tenant";
}

export function roleLabel(role: ContactRole): string {
  if (role === "owner") return "Owner";
  if (role === "neighbour") return "Neighbour";
  if (role === "other") return "Other";
  return "Tenant";
}

export function notionSelectName(role: ContactRole): string {
  return roleLabel(role);
}

/** Tenants first. Owners only when the job has no tenant. Never a neighbour or other. */
export function primaryContacts<T extends { role: ContactRole }>(contacts: T[]): T[] {
  const tenants = contacts.filter((contact) => contact.role === "tenant");
  if (tenants.length > 0) return tenants;
  return contacts.filter((contact) => contact.role === "owner");
}

/** Notion filter: Select is empty or Tenant. Neighbour and Other stay out. */
export function primarySelectFilter(): Record<string, unknown> {
  return {
    or: [
      { property: "Select", select: { is_empty: true } },
      { property: "Select", select: { equals: "Tenant" } },
    ],
  };
}

export function contactCardName(name: string, address: string, role: ContactRole): string {
  const person = name.trim() || roleLabel(role);
  const place = normalisePropertyAddress(address) || address.trim();
  return `${person} · ${place} · ${roleLabel(role)}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export type NeighbourProgress = "none" | "N1 sent" | "Followed up" | "Booked";

export const neighbourProgressSteps: NeighbourProgress[] = ["none", "N1 sent", "Followed up", "Booked"];

export function neighbourProgress(value: string): NeighbourProgress {
  if (value === "N1 sent" || value === "Followed up" || value === "Booked") return value;
  return "none";
}

export function nextNeighbourProgress(current: NeighbourProgress): NeighbourProgress | null {
  const index = neighbourProgressSteps.indexOf(current);
  const next = neighbourProgressSteps[index + 1];
  return next ?? null;
}

/** The only status moves the page offers, and only after Pat confirms. */
export function guidedNext(status: string, vacant: boolean): { text: string; nextStatus: string } | null {
  if (vacant) {
    return { text: "This property is vacant. Arrange the key pickup, then the neighbours. Do not text a tenant or owner.", nextStatus: "" };
  }
  const next: Record<string, { text: string; nextStatus: string }> = {
    "Contacting Tenant 0": { text: "Text the tenants to arrange access.", nextStatus: "Contacting Tenant 1" },
    "Contacting Tenant 1": { text: "Follow up with the tenants if they have not replied.", nextStatus: "Contacting Tenant 2" },
    "Contacting Tenant 2": { text: "One more try, then the property manager is copied by email.", nextStatus: "Contacting Tenant 3 Cc PM" },
  };
  return next[status] ?? { text: "Use the group that matches this visit. Neighbours stay in their own thread.", nextStatus: "" };
}
