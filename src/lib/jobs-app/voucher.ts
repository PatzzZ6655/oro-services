export type VoucherStatus = "none" | "redeemed" | "notFound" | "alreadyRedeemed" | "expired";

export function cleanVoucherCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

export function voucherStatus(value: unknown): VoucherStatus {
  if (value === "redeemed" || value === "notFound" || value === "alreadyRedeemed" || value === "expired" || value === "none") {
    return value;
  }
  return "none";
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
  const warnings: Record<"notFound" | "expired", string> = {
    notFound: "This voucher code was not found. The job was still created.",
    expired: "This voucher has expired. The job was still created.",
  };
  return { tone: "warn", text: warnings[status] };
}
