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

export function voucherNote(status: VoucherStatus, code: string, value: string): { tone: "ok" | "warn"; text: string } | null {
  if (status === "none") return null;
  if (status === "redeemed") {
    const amount = value.startsWith("$") ? value : value ? `$${value}` : "";
    return { tone: "ok", text: amount ? `已核销 ${code}，减 ${amount}` : `已核销 ${code}` };
  }
  const warnings: Record<Exclude<VoucherStatus, "none" | "redeemed">, string> = {
    notFound: "没找到这个券码。工单仍已创建。",
    alreadyRedeemed: "这个券已经核销过了。工单仍已创建。",
    expired: "这个券已过期。工单仍已创建。",
  };
  return { tone: "warn", text: warnings[status] };
}
