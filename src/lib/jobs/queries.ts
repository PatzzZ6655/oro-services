export type JobRow = {
  id: string;
  company: "emoro" | "emporo";
  job_number: number;
  client_name: string;
  phone: string | null;
  email: string | null;
  address: string;
  status: "open" | "complete";
  created_by: string;
  created_at: Date | string;
};

export type ReportRow = {
  id: string;
  job_id: string;
  form_type: string;
  drive_file_id: string;
  drive_url: string;
  answers: string;
  submitted_by: string;
  submitted_at: Date | string;
};

export type Query = <T>(text: string, params?: unknown[]) => Promise<T[]>;

export function sqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((part) => part.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
}

const jobColumns = "id, company, job_number, client_name, phone, email, address, status, created_by, created_at";

export async function insertJob(
  query: Query,
  input: { id: string; company: "emoro" | "emporo"; clientName: string; phone: string; email: string; address: string; createdBy: string },
): Promise<JobRow> {
  const rows = await query<JobRow>(
    `INSERT INTO jobs (id, company, job_number, client_name, phone, email, address, status, created_by)
     VALUES ($1, $2, nextval('job_number_seq'), $3, $4, $5, $6, 'open', $7)
     RETURNING ${jobColumns}`,
    [input.id, input.company, input.clientName, input.phone || null, input.email || null, input.address, input.createdBy],
  );
  const row = rows[0];
  if (!row) throw new Error("The job was not created.");
  return row;
}

export async function searchJobs(query: Query, term: string): Promise<JobRow[]> {
  const needle = term.replace(/[%_]/g, "").trim();
  return query<JobRow>(
    `SELECT ${jobColumns} FROM jobs
     WHERE ($1 = '' OR lower(client_name) LIKE '%' || lower($1) || '%' OR lower(address) LIKE '%' || lower($1) || '%')
     ORDER BY created_at DESC
     LIMIT 50`,
    [needle],
  );
}

export async function getJob(query: Query, id: string): Promise<JobRow | null> {
  const rows = await query<JobRow>(`SELECT ${jobColumns} FROM jobs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function setJobStatus(query: Query, id: string, status: "open" | "complete"): Promise<void> {
  await query(`UPDATE jobs SET status = $2 WHERE id = $1`, [id, status]);
}

export async function listJobReports(query: Query, jobId: string): Promise<ReportRow[]> {
  return query<ReportRow>(
    `SELECT id, job_id, form_type, drive_file_id, drive_url, answers, submitted_by, submitted_at
     FROM job_reports WHERE job_id = $1 ORDER BY submitted_at DESC`,
    [jobId],
  );
}

export async function insertJobReport(
  query: Query,
  input: { id: string; jobId: string; formType: string; driveFileId: string; driveUrl: string; answers: string; submittedBy: string },
): Promise<void> {
  await query(
    `INSERT INTO job_reports (id, job_id, form_type, drive_file_id, drive_url, answers, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.id, input.jobId, input.formType, input.driveFileId, input.driveUrl, input.answers, input.submittedBy],
  );
}

export async function latestAnswers(query: Query, jobId: string, formType: string, address: string): Promise<Record<string, string> | null> {
  const rows = await query<{ answers: string }>(
    `SELECT r.answers FROM job_reports r
     JOIN jobs j ON j.id = r.job_id
     WHERE r.form_type = $2 AND (r.job_id = $1 OR lower(j.address) = lower($3))
     ORDER BY CASE WHEN r.job_id = $1 THEN 0 ELSE 1 END, r.submitted_at DESC
     LIMIT 1`,
    [jobId, formType, address],
  );
  const raw = rows[0]?.answers;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Record<string, string>;
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") continue;
    if (key === "reviewedToday" || key === "jobId" || key.includes("signature") || key.startsWith("itemPhoto") || key === "photos") continue;
    if (value.startsWith("data:image")) continue;
    answers[key] = value;
  }
  return answers;
}

export function answersFromForm(formData: FormData): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key === "reviewedToday" || key === "jobId" || key.includes("signature") || key.startsWith("itemPhoto") || key === "photos") continue;
    if (value.startsWith("data:image")) continue;
    answers[key] = value;
  }
  return answers;
}
