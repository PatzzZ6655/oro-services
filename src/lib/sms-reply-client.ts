export const smsReplyBrands = {
  emoro: "Emoro Building",
  emporo: "Emporo Plumbing",
} as const;

export type SmsReplyBrand = keyof typeof smsReplyBrands;

/** iOS Messages compose with the body filled in and no recipient. */
export function smsBodyHref(body: string): string {
  return `sms:&body=${encodeURIComponent(body)}`;
}
