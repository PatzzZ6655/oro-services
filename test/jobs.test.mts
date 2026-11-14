import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newDb } from "pg-mem";
import { answersFromForm, insertJob, latestAnswers, searchJobs, sqlStatements, type Query } from "@/lib/jobs/queries";
import { summaryOrder, swmsIsUnscored, tally, type SummaryItem } from "@/lib/reports/summary";
import { submissionFolderName } from "@/lib/reports/paths";

const migration = readFileSync(new URL("../db/migrations/001_jobs.sql", import.meta.url), "utf8");

function memoryQuery(): Query {
  const db = newDb();
  for (const statement of sqlStatements(migration)) db.public.none(statement);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  return async (text, params = []) => {
    const result = await pool.query(text, params);
    return result.rows as never[];
  };
}

test("the jobs schema stores a job number, a search, and the last answers", async () => {
  const query = memoryQuery();
  const first = await insertJob(query, {
    id: "job-1",
    company: "emporo",
    clientName: "Alex Client",
    phone: "",
    email: "alex@example.com",
    address: "12 Smith Street, Richmond",
    createdBy: "pat.z@orosvc.com",
  });
  const second = await insertJob(query, {
    id: "job-2",
    company: "emoro",
    clientName: "Other",
    phone: "0400000000",
    email: "",
    address: "9 High Street, Hawthorn",
    createdBy: "pat.z@orosvc.com",
  });
  assert.equal(first.job_number, 1001);
  assert.equal(second.job_number, 1002);
  const found = await searchJobs(query, "richmond");
  assert.equal(found.length, 1);
  assert.equal(found[0]?.client_name, "Alex Client");

  await query(
    `INSERT INTO job_reports (id, job_id, form_type, drive_file_id, drive_url, answers, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ["report-1", "job-1", "swms", "file-1", "https://drive.example/1", JSON.stringify({ work: "Roof", reviewedToday: "yes", "worker.0.signature": "data:image/png;base64,abc" }), "pat.z@orosvc.com"],
  );
  const copied = await latestAnswers(query, "job-1", "swms", "12 Smith Street, Richmond");
  assert.equal(copied?.work, "Roof");
  assert.equal(copied?.reviewedToday, undefined);
  assert.equal(copied?.["worker.0.signature"], undefined);
});

test("saved answers drop signatures, photos, and the daily SWMS review", () => {
  const data = new FormData();
  data.set("work", "Roof");
  data.set("reviewedToday", "yes");
  data.set("worker.0.signature", "data:image/png;base64,abc");
  data.append("photos", new File([Uint8Array.of(1)], "a.jpg", { type: "image/jpeg" }));
  data.set("keyPhoto.readings", "not-a-photo");
  const answers = answersFromForm(data);
  assert.equal(answers.work, "Roof");
  assert.equal(answers.reviewedToday, undefined);
  assert.equal("worker.0.signature" in answers, false);
  assert.equal(answers["keyPhoto.readings"], undefined);
});

test("a job folder is keyed by the job number and address", () => {
  assert.equal(submissionFolderName("2026-11-14", "12 Smith Street", "1001"), "1001 12 Smith Street");
  assert.equal(submissionFolderName("2026-11-14", "12 Smith Street"), "2026-11-14 12 Smith Street");
});

test("the summary lists fails first and hides not applicable rows", () => {
  const items: SummaryItem[] = [
    { label: "Meter", result: "pass", photoKey: "check.meter" },
    { label: "Leak", result: "fail", comment: "Drop", photoKey: "check.leak" },
    { label: "Pool", result: "na", photoKey: "check.pool" },
    { label: "Flue", result: "pass", photoKey: "check.flue" },
  ];
  const ordered = summaryOrder(items, new Set(["check.flue", "check.leak"]));
  assert.deepEqual(ordered.map((item) => item.label), ["Leak", "Flue"]);
  assert.deepEqual(tally(items), { pass: 2, fail: 1, na: 1 });
  assert.equal(swmsIsUnscored(), true);
});
