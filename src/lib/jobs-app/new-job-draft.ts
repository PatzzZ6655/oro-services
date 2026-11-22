import { blankTenants, cleanTenant, maxJobTenants, newJobTextLimits, type JobTenant } from "@/lib/jobs-app/new-job-text";
import { isBusiness, type Business, type NewJobResult } from "@/lib/jobs-app/types";
import { voucherStatus } from "@/lib/jobs-app/voucher";

export const newJobDraftKey = "oro.jobs.new.draft";
export const newJobIntroKey = "oro.jobs.new.intro";

export type NewJobReadSnapshot = {
  tenantName: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  workOrderNumber: string;
  voucher: string;
  tenant2Name: string;
  phone2: string;
  email2: string;
  tenants: JobTenant[];
  pmName: string;
  pmAgency: string;
  pmEmail: string;
  pmPhone: string;
};

export type NewJobDraft = {
  step: "capture" | "check";
  business: Business | "";
  tenantName: string;
  phone: string;
  tenants: JobTenant[];
  address: string;
  pmAgency: string;
  description: string;
  notes: string;
  workOrderNumber: string;
  voucher: string;
  read: NewJobReadSnapshot | null;
  screenshotCount: number;
};

export type NewJobIntroHold = {
  business: Business;
  tenants: JobTenant[];
  result: NewJobResult;
};

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function tenantRows(value: unknown, keepBlank: boolean): JobTenant[] {
  if (!Array.isArray(value)) return keepBlank ? blankTenants() : [];
  const rows = value.slice(0, maxJobTenants).map((item) => {
    if (!item || typeof item !== "object") return cleanTenant({});
    const row = item as Record<string, unknown>;
    return cleanTenant({
      name: typeof row.name === "string" ? row.name : "",
      phone: typeof row.phone === "string" ? row.phone : "",
      email: typeof row.email === "string" ? row.email : "",
    });
  });
  if (!keepBlank) return rows.filter((row) => row.name || row.phone || row.email);
  return rows.length > 0 ? rows : blankTenants();
}

function countShots(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(4, Math.floor(count)));
}

export function emptyNewJobDraft(): NewJobDraft {
  return {
    step: "capture",
    business: "",
    tenantName: "",
    phone: "",
    tenants: blankTenants(),
    address: "",
    pmAgency: "",
    description: "",
    notes: "",
    workOrderNumber: "",
    voucher: "",
    read: null,
    screenshotCount: 0,
  };
}

export function parseReadSnapshot(value: unknown): NewJobReadSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const read: NewJobReadSnapshot = {
    tenantName: clip(row.tenantName, newJobTextLimits.tenantName),
    phone: clip(row.phone, newJobTextLimits.phone),
    email: clip(row.email, 120),
    address: clip(row.address, newJobTextLimits.address),
    description: clip(row.description, newJobTextLimits.description),
    workOrderNumber: clip(row.workOrderNumber, newJobTextLimits.workOrderNumber),
    voucher: clip(row.voucher, 40),
    tenant2Name: clip(row.tenant2Name, newJobTextLimits.tenantName),
    phone2: clip(row.phone2, newJobTextLimits.phone),
    email2: clip(row.email2, 120),
    tenants: tenantRows(row.tenants, false),
    pmName: clip(row.pmName, 80),
    pmAgency: clip(row.pmAgency, 80),
    pmEmail: clip(row.pmEmail, 120),
    pmPhone: clip(row.pmPhone, 40),
  };
  const text = Object.entries(read).some(([key, item]) => key !== "tenants" && typeof item === "string" && item);
  return text || read.tenants.length > 0 ? read : null;
}

export function newJobDraftDirty(draft: NewJobDraft): boolean {
  if (draft.business || draft.step === "check" || draft.read || draft.screenshotCount > 0) return true;
  if (draft.tenantName || draft.phone || draft.address || draft.pmAgency || draft.description || draft.notes || draft.workOrderNumber || draft.voucher) {
    return true;
  }
  return draft.tenants.some((row) => row.name || row.phone || row.email);
}

export function parseNewJobDraft(raw: string | null): NewJobDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return null;
    const business = isBusiness(value.business) ? value.business : "";
    const draft: NewJobDraft = {
      step: value.step === "check" && business ? "check" : "capture",
      business,
      tenantName: clip(value.tenantName, newJobTextLimits.tenantName),
      phone: clip(value.phone, newJobTextLimits.phone),
      tenants: tenantRows(value.tenants, true),
      address: clip(value.address, newJobTextLimits.address),
      pmAgency: clip(value.pmAgency, 80),
      description: clip(value.description, newJobTextLimits.description),
      notes: clip(value.notes, newJobTextLimits.notes),
      workOrderNumber: clip(value.workOrderNumber, newJobTextLimits.workOrderNumber),
      voucher: clip(value.voucher, 40).toUpperCase(),
      read: parseReadSnapshot(value.read),
      screenshotCount: countShots(value.screenshotCount),
    };
    return newJobDraftDirty(draft) ? draft : null;
  } catch {
    return null;
  }
}

function flag(value: unknown): boolean | null {
  return value === true || value === false ? value : null;
}

export function parseNewJobIntroHold(raw: string | null): NewJobIntroHold | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || !isBusiness(value.business)) return null;
    const result = value.result;
    if (!result || typeof result !== "object") return null;
    const row = result as Record<string, unknown>;
    const jobId = clip(row.jobId, 80);
    const jobUrl = clip(row.jobUrl, 2000);
    if (!jobId && !jobUrl) return null;
    return {
      business: value.business,
      tenants: tenantRows(value.tenants, true),
      result: {
        ok: true,
        jobUrl,
        jobId,
        jobTitle: clip(row.jobTitle, 300),
        brand: clip(row.brand, 80),
        address: clip(row.address, newJobTextLimits.address),
        desc: clip(row.desc, newJobTextLimits.description),
        tenant1: clip(row.tenant1, 80),
        phone1: clip(row.phone1, 40),
        email1: clip(row.email1, 120),
        tenant2: clip(row.tenant2, 80),
        phone2: clip(row.phone2, 40),
        pmName: clip(row.pmName, 80),
        pmAgency: clip(row.pmAgency, 80),
        pmEmail: clip(row.pmEmail, 120),
        pmPhone: clip(row.pmPhone, 40),
        workOrderNumber: clip(row.workOrderNumber, newJobTextLimits.workOrderNumber),
        description: clip(row.description, newJobTextLimits.description),
        tenants: tenantRows(row.tenants, false),
        propertyCreated: flag(row.propertyCreated),
        customerCreated: flag(row.customerCreated),
        contact1Created: flag(row.contact1Created),
        voucherStatus: voucherStatus(row.voucherStatus),
        voucherCode: clip(row.voucherCode, 40),
        voucherValue: clip(row.voucherValue, 40),
        voucherMessage: clip(row.voucherMessage, 300),
        voucherBusiness: clip(row.voucherBusiness, 40),
        voucherRedeemedDate: clip(row.voucherRedeemedDate, 40),
      },
    };
  } catch {
    return null;
  }
}

function store(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function readNewJobSnapshot(): string {
  try {
    if (typeof sessionStorage === "undefined") return "\0";
    const intro = sessionStorage.getItem(newJobIntroKey);
    if (intro) return `intro\n${intro}`;
    const draft = sessionStorage.getItem(newJobDraftKey);
    if (draft) return `draft\n${draft}`;
  } catch {
    // A blocked store leaves the form empty.
  }
  return "\0";
}

export function readStoredNewJobDraft(): NewJobDraft | null {
  try {
    return parseNewJobDraft(store()?.getItem(newJobDraftKey) ?? null);
  } catch {
    return null;
  }
}

export function writeStoredNewJobDraft(draft: NewJobDraft): void {
  const memory = store();
  if (!memory) return;
  try {
    if (!newJobDraftDirty(draft)) {
      memory.removeItem(newJobDraftKey);
      return;
    }
    memory.setItem(newJobDraftKey, JSON.stringify(draft));
  } catch {
    // A full or blocked store must not stop the person typing.
  }
}

export function clearStoredNewJobDraft(): void {
  try {
    store()?.removeItem(newJobDraftKey);
  } catch {
    // Ignore a blocked store.
  }
}

export function readStoredNewJobIntro(): NewJobIntroHold | null {
  try {
    return parseNewJobIntroHold(store()?.getItem(newJobIntroKey) ?? null);
  } catch {
    return null;
  }
}

export function writeStoredNewJobIntro(hold: NewJobIntroHold): void {
  const memory = store();
  if (!memory) return;
  try {
    memory.setItem(newJobIntroKey, JSON.stringify(hold));
  } catch {
    // A full or blocked store must not stop the intro screen.
  }
}

export function clearStoredNewJobIntro(): void {
  try {
    store()?.removeItem(newJobIntroKey);
  } catch {
    // Ignore a blocked store.
  }
}
