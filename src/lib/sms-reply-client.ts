export const smsReplyBrands = {
  emoro: "Emoro Building",
  emporo: "Emporo Plumbing",
} as const;

export type SmsReplyBrand = keyof typeof smsReplyBrands;

/** iOS Messages compose with the body filled in and no recipient. */
export function smsBodyHref(body: string): string {
  return `sms:&body=${encodeURIComponent(body)}`;
}

/** Keys this page may have stored. Other app keys are left alone. */
export function isSmsReplyStorageKey(key: string): boolean {
  return key.startsWith("oro.sms") || key.includes("sms-reply");
}

export function clearSmsReplyStorage(stores: Array<{ length: number; key(index: number): string | null; removeItem(key: string): void } | null>): void {
  for (const store of stores) {
    if (!store) continue;
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && isSmsReplyStorageKey(key)) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  }
}
