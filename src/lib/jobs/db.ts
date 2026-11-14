import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  getJob,
  insertJob,
  insertJobReport,
  latestAnswers,
  listJobReports,
  searchJobs,
  setJobStatus,
  sqlStatements,
  type JobRow,
  type Query,
  type ReportRow,
} from "@/lib/jobs/queries";

let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  }
  return pool;
}

const query: Query = async <T>(text: string, params: unknown[] = []) => {
  const result = await getPool().query(text, params);
  return result.rows as T[];
};

function migrate(): Promise<void> {
  ready ??= (async () => {
    const sql = readFileSync(join(process.cwd(), "db/migrations/001_jobs.sql"), "utf8");
    for (const statement of sqlStatements(sql)) await getPool().query(statement);
  })();
  return ready;
}

async function withDb<T>(run: () => Promise<T>): Promise<T> {
  if (!databaseConfigured()) throw new Error("Jobs database not connected");
  await migrate();
  return run();
}

export async function createJob(input: {
  company: "emoro" | "emporo";
  clientName: string;
  phone: string;
  email: string;
  address: string;
  createdBy: string;
}): Promise<JobRow> {
  return withDb(() => insertJob(query, { ...input, id: crypto.randomUUID() }));
}

export async function findJobs(term: string): Promise<JobRow[]> {
  return withDb(() => searchJobs(query, term));
}

export async function readJob(id: string): Promise<JobRow | null> {
  return withDb(() => getJob(query, id));
}

export async function markJob(id: string, status: "open" | "complete"): Promise<void> {
  await withDb(() => setJobStatus(query, id, status));
}

export async function readJobReports(jobId: string): Promise<ReportRow[]> {
  return withDb(() => listJobReports(query, jobId));
}

export async function recordJobReport(input: {
  jobId: string;
  formType: string;
  driveFileId: string;
  driveUrl: string;
  answers: string;
  submittedBy: string;
}): Promise<void> {
  await withDb(() => insertJobReport(query, { ...input, id: crypto.randomUUID() }));
}

export async function copyLast(jobId: string, formType: string, address: string): Promise<Record<string, string> | null> {
  return withDb(() => latestAnswers(query, jobId, formType, address));
}
