import pg from "pg";
import { databaseConnectionString } from "@/lib/jobs/connection";

const windowMs = 10 * 60 * 1000;
const maxHits = 5;

const hits = new Map<string, number[]>();
let pool: pg.Pool | null = null;
let tableReady: Promise<void> | null = null;

const createTable = `
  CREATE TABLE IF NOT EXISTS enquiry_rate (
    ip text NOT NULL,
    at timestamptz NOT NULL DEFAULT now()
  )
`;
const createIndex = "CREATE INDEX IF NOT EXISTS enquiry_rate_ip_at ON enquiry_rate (ip, at)";

export type RateQuery = (text: string, params?: unknown[]) => Promise<Array<{ n?: number | string }>>;

/** A missing address must not share one bucket, or one caller could block everyone else. */
export function rateLimitKey(key: string): string | null {
  const ip = key.trim();
  if (!ip || ip === "unknown") return null;
  return ip.slice(0, 80);
}

export function allowFromMemory(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= maxHits) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    for (const [storedKey, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(storedKey);
    }
  }
  return true;
}

export function resetEnquiryLimits(): void {
  hits.clear();
}

export async function recordSharedHit(query: RateQuery, ip: string): Promise<boolean> {
  await query("DELETE FROM enquiry_rate WHERE at < now() - interval '10 minutes'");
  const rows = await query("SELECT count(*) AS n FROM enquiry_rate WHERE ip = $1", [ip]);
  const count = Number(rows[0]?.n ?? 0);
  if (count >= maxHits) return false;
  await query("INSERT INTO enquiry_rate (ip) VALUES ($1)", [ip]);
  return true;
}

function enquiryPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: databaseConnectionString(url), max: 1 });
  return pool;
}

async function ensureTable(db: pg.Pool): Promise<void> {
  tableReady ??= (async () => {
    await db.query(createTable);
    await db.query(createIndex);
  })().catch((error: unknown) => {
    tableReady = null;
    throw error;
  });
  return tableReady;
}

async function allowFromDatabase(ip: string, db: pg.Pool): Promise<boolean> {
  await ensureTable(db);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const allowed = await recordSharedHit(async (text, params = []) => {
      const result = await client.query(text, params);
      return result.rows as Array<{ n?: number | string }>;
    }, ip);
    await client.query("COMMIT");
    return allowed;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function allowEnquiry(key: string): Promise<boolean> {
  const ip = rateLimitKey(key);
  if (!ip) return true;
  const db = enquiryPool();
  if (!db) return allowFromMemory(ip);
  try {
    return await allowFromDatabase(ip, db);
  } catch {
    // A database failure must not stop every enquiry.
    return allowFromMemory(ip);
  }
}

export function clientAddress(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  return headerStore.get("x-real-ip")?.slice(0, 80) ?? "";
}
