export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[^\d+]/g, "");
  if (!compact) return null;
  let digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (digits.startsWith("0")) digits = `61${digits.slice(1)}`;
  if (!digits.startsWith("61")) return null;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone) ?? phone.trim();
  const digits = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  if (digits.startsWith("61") && digits.length === 11) {
    return `+61 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return normalized;
}
