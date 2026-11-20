const windowMs = 15 * 60 * 1000;
const maxFailures = 5;
const failures = new Map<string, number[]>();

export function resetJobsLoginLimits(): void {
  failures.clear();
}

export function loginAllowed(key: string, now = Date.now()): boolean {
  const recent = (failures.get(key) ?? []).filter((time) => now - time < windowMs);
  failures.set(key, recent);
  return recent.length < maxFailures;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const recent = (failures.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  failures.set(key, recent);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

export function clientKey(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  return headerStore.get("x-real-ip")?.slice(0, 80) ?? "unknown";
}

export function jobsPassword(raw = process.env.JOBS_APP_PASSWORD): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function passwordsMatch(input: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index]! ^ b[index]!;
  return mismatch === 0 && input.length > 0 && input.length <= 200;
}
