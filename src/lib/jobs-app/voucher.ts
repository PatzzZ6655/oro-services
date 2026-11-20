export type VoucherStatus = "none" | "redeemed" | "notFound" | "alreadyRedeemed" | "expired" | "error";

export type ApplyVoucherStatus = VoucherStatus | "jobNotFound" | "invoiceIssued" | "jobHasVoucher";

export function cleanVoucherCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

export function voucherStatus(value: unknown): VoucherStatus {
  if (value === "redeemed" || value === "notFound" || value === "alreadyRedeemed" || value === "expired" || value === "none" || value === "error") {
    return value;
  }
  return "none";
}

export function applyVoucherStatus(value: unknown): ApplyVoucherStatus {
  if (
    value === "redeemed" ||
    value === "none" ||
    value === "error" ||
    value === "notFound" ||
    value === "alreadyRedeemed" ||
    value === "expired" ||
    value === "jobNotFound" ||
    value === "invoiceIssued" ||
    value === "jobHasVoucher"
  ) {
    return value;
  }
  return "none";
}

export function notionPageId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cut = trimmed.split("#")[0]?.split("?")[0] ?? "";
  const pattern = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{32}/g;
  let last: string | null = null;
  for (const match of cut.matchAll(pattern)) last = match[0].replace(/-/g, "").toLowerCase();
  return last && /^[0-9a-f]{32}$/.test(last) ? last : null;
}

export function canApplyVoucher(input: { hasJob: boolean; code: string; pending: boolean; redeemed: boolean }): boolean {
  return input.hasJob && input.code.trim().length > 0 && !input.pending && !input.redeemed;
}

export function voucherSmsTemplates(code: string): [string, string] {
  const token = code.trim() || "[CODE]";
  return [
    `Thanks [Name], your job is approved. Voucher ${token} has been applied (-$60). Final price: $[X] incl GST.`,
    `Hi [Name], as discussed we've reduced the price to $[X] incl GST. As vouchers can't be combined with other discounts, voucher ${token} is no longer valid.`,
  ];
}

export function voucherNote(
  status: VoucherStatus,
  code: string,
  value: string,
  redeemedDate = "",
): { tone: "ok" | "warn"; text: string } | null {
  if (status === "none") return null;
  if (status === "redeemed") {
    const amount = value.startsWith("$") ? value : value ? `$${value}` : "";
    return { tone: "ok", text: amount ? `Redeemed ${code}, less ${amount}` : `Redeemed ${code}` };
  }
  if (status === "alreadyRedeemed") {
    const when = redeemedDate ? ` on ${redeemedDate}` : "";
    return { tone: "warn", text: `This voucher was already redeemed${when}. The job was still created.` };
  }
  if (status === "error") {
    return {
      tone: "warn",
      text: "The voucher could not be marked as used, so it was NOT applied. The job was still created. Use Apply voucher on this job.",
    };
  }
  const warnings: Record<"notFound" | "expired", string> = {
    notFound: "This voucher code was not found. The job was still created.",
    expired: "This voucher has expired. The job was still created.",
  };
  return { tone: "warn", text: warnings[status] };
}
