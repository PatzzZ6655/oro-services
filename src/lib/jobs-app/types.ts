import type { ApplyVoucherStatus, VoucherStatus } from "@/lib/jobs-app/voucher";

export type Business = "emoro" | "emporo";

export function isBusiness(value: unknown): value is Business {
  return value === "emoro" || value === "emporo";
}

export function businessLabel(business: Business): string {
  return business === "emoro" ? "Emoro Building" : "Emporo Plumbing";
}

export type TodayJob = {
  business: Business;
  jobId: string;
  title: string;
  address: string;
  status: string;
  scheduled: string;
};

export type Contact = {
  name: string;
  phone: string;
  sms: string;
};

export type JobsError = {
  ok: false;
  error: string;
  message: string;
};

export type DepartResult = {
  ok: true;
  business: Business;
  brand: string;
  visit: string;
  jobTitle: string;
  address: string;
  tenant: string;
  contacts: Contact[];
  sms: string;
  departedAt: string;
  jobStatus: string;
};

export type LeaveResult = {
  ok: true;
  business: Business;
  brand: string;
  outcome: "return" | "complete";
  visit: string;
  jobTitle: string;
  address: string;
  tenant: string;
  contacts: Contact[];
  sms: string;
  driveLink: string;
  checklist: string;
  issues: string;
  summary: string;
  reviewLinkConfigured: boolean;
  pmEmailedTo: string;
  voucherCode: string;
  voucherExpiry: string;
  leftAt: string;
};

export type NewJobResult = {
  ok: true;
  jobUrl: string;
  jobId: string;
  jobTitle: string;
  brand: string;
  address: string;
  desc: string;
  tenant1: string;
  phone1: string;
  email1: string;
  tenant2: string;
  phone2: string;
  pmName: string;
  pmAgency: string;
  pmEmail: string;
  pmPhone: string;
  workOrderNumber: string;
  description: string;
  tenants: { name: string; phone: string; email: string }[];
  propertyCreated: boolean | null;
  customerCreated: boolean | null;
  contact1Created: boolean | null;
  voucherStatus: VoucherStatus;
  voucherCode: string;
  voucherValue: string;
  voucherMessage: string;
  voucherBusiness: string;
  voucherRedeemedDate: string;
};

export type ApplyVoucherResult = {
  ok: true;
  mode: "applyVoucher";
  business: Business;
  brand: string;
  jobId: string;
  jobUrl: string;
  jobTitle: string;
  voucherStatus: ApplyVoucherStatus;
  voucherCode: string;
  voucherValue: number;
  voucherBusiness: string;
  voucherRedeemedDate: string;
  voucherMessage: string;
  noteWritten: boolean;
};

export type JobsResult<T> = { status: number; body: T | JobsError };
