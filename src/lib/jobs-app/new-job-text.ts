export const newJobTextLimits = {
  tenantName: 80,
  phone: 40,
  address: 300,
  description: 2000,
  workOrderNumber: 80,
  notes: 2000,
} as const;

export const newJobTextFields = ["tenantName", "phone", "address", "description", "workOrderNumber", "notes"] as const;

export type NewJobTextField = (typeof newJobTextFields)[number];

export type NewJobText = Record<NewJobTextField, string>;

export const newJobNeedDetail = "Choose a screenshot, or enter a name or address and a description.";

export const screenshotReadFallback = "Couldn't read the screenshots — type the details in";

export function preferTyped(typed: string, read: string): string {
  return typed.trim() ? typed : read.trim();
}

export const tenantLimits = { name: 80, phone: 40, email: 120 } as const;

export const maxJobTenants = 8;

export type JobTenant = { name: string; phone: string; email: string };

export function cleanTenant(input: { name?: string; phone?: string; email?: string }): JobTenant {
  return {
    name: oneLine(input.name ?? "", tenantLimits.name),
    phone: oneLine(input.phone ?? "", tenantLimits.phone),
    email: oneLine(input.email ?? "", tenantLimits.email),
  };
}

export function tenantHasDetail(tenant: JobTenant): boolean {
  return Boolean(tenant.name || tenant.phone || tenant.email);
}

export function blankTenants(): JobTenant[] {
  return [{ name: "", phone: "", email: "" }];
}

export function tenantsFromTyped(name: string, phone: string): JobTenant[] {
  return [cleanTenant({ name, phone, email: "" })];
}

function tenantRows(value: unknown): JobTenant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return cleanTenant({
        name: typeof row.name === "string" ? row.name : "",
        phone: typeof row.phone === "string" ? row.phone : "",
        email: typeof row.email === "string" ? row.email : "",
      });
    })
    .filter((row): row is JobTenant => row !== null && tenantHasDetail(row))
    .slice(0, maxJobTenants);
}

export function parseTenantList(value: unknown): JobTenant[] {
  if (typeof value === "string" && value.trim()) {
    try {
      return tenantRows(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return tenantRows(value);
}

export function tenantsFromRead(
  read: {
    tenants?: unknown;
    tenantName?: string;
    phone?: string;
    email?: string;
    tenant2Name?: string;
    phone2?: string;
    email2?: string;
  },
  typed: { name: string; phone: string },
): JobTenant[] {
  const fromList = parseTenantList(read.tenants);
  const first = cleanTenant({ name: read.tenantName, phone: read.phone, email: read.email });
  const second = cleanTenant({ name: read.tenant2Name, phone: read.phone2, email: read.email2 });
  const paired = [first, second].filter(tenantHasDetail);
  const rows = fromList.length > 0 ? fromList : paired.length > 0 ? paired : blankTenants();
  const current = rows[0] ?? { name: "", phone: "", email: "" };
  rows[0] = {
    name: preferTyped(typed.name, current.name),
    phone: preferTyped(typed.phone, current.phone),
    email: current.email,
  };
  return rows;
}

export function readTenantsField(value: FormDataEntryValue | null): JobTenant[] {
  return typeof value === "string" ? parseTenantList(value) : [];
}

export function tenantPayload(tenants: JobTenant[]): Record<string, string> {
  const rows = tenants.map((row) => cleanTenant(row)).filter(tenantHasDetail).slice(0, maxJobTenants);
  const payload: Record<string, string> = { tenants: JSON.stringify(rows) };
  const first = rows[0];
  const second = rows[1];
  if (first?.name) payload.tenantName = first.name;
  if (first?.phone) payload.phone = first.phone;
  if (first?.email) payload.email = first.email;
  if (second?.name) payload.tenant2Name = second.name;
  if (second?.phone) payload.phone2 = second.phone;
  if (second?.email) payload.email2 = second.email;
  return payload;
}

function oneLine(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function noteText(value: string, max: number): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export function readNewJobText(form: FormData): NewJobText {
  const raw = (key: NewJobTextField) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    tenantName: oneLine(raw("tenantName"), newJobTextLimits.tenantName),
    phone: oneLine(raw("phone"), newJobTextLimits.phone),
    address: oneLine(raw("address"), newJobTextLimits.address),
    description: oneLine(raw("description"), newJobTextLimits.description),
    workOrderNumber: oneLine(raw("workOrderNumber"), newJobTextLimits.workOrderNumber),
    notes: noteText(raw("notes"), newJobTextLimits.notes),
  };
}

export function newJobTextPayload(text: NewJobText): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const key of newJobTextFields) {
    if (text[key]) payload[key] = text[key];
  }
  return payload;
}

export function newJobTextCoversScreenshots(text: NewJobText): boolean {
  return (text.tenantName.length > 0 || text.address.length > 0) && text.description.length > 0;
}
