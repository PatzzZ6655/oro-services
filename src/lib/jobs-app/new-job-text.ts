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
