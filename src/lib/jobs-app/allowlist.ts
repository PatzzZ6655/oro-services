import { normalizeEmail } from "@/lib/auth/session";

export function jobsAllowlist(raw = process.env.JOBS_ALLOWED_EMAILS): Set<string> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const emails = new Set<string>();
  for (const part of raw.split(",")) {
    const email = normalizeEmail(part);
    if (email) emails.add(email);
  }
  return emails.size > 0 ? emails : null;
}

export function jobsEmailAllowed(email: string, raw = process.env.JOBS_ALLOWED_EMAILS): boolean {
  const list = jobsAllowlist(raw);
  const normalized = normalizeEmail(email);
  if (!list || !normalized) return false;
  return list.has(normalized);
}
