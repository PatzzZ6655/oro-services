import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normaliseNote, noteCost, noteNotionProperties, notePropertyNames, resolveNoteDate } from "@/lib/jobs-app/job-notes";
import { noteSecretOk } from "@/lib/jobs-app/job-notes-store";
import { guessNoteJob, inProgressToday, jobsInGroup, noteJobLabel, type NoteJob } from "@/lib/jobs-app/note-groups";

const today = "2026-11-25";
const now = new Date("2026-11-25T01:00:00.000Z");

function job(partial: Partial<NoteJob> & Pick<NoteJob, "business" | "jobId" | "status">): NoteJob {
  return {
    title: partial.title ?? "Job",
    address: partial.address ?? "",
    scheduled: partial.scheduled ?? "",
    tenant: partial.tenant ?? "",
    ...partial,
  };
}

const sample: NoteJob[] = [
  job({ business: "emporo", jobId: "b".repeat(32), status: "In Progress", address: "9 River St", scheduled: "2026-11-25", tenant: "Lee" }),
  job({ business: "emoro", jobId: "a".repeat(32), status: "In Progress", address: "12 Smith St", scheduled: "2026-11-25", tenant: "Sam" }),
  job({ business: "emoro", jobId: "c".repeat(32), status: "In Progress", address: "4 Park St", scheduled: "2026-11-26", tenant: "Jo" }),
  job({ business: "emoro", jobId: "d".repeat(32), status: "Contacting Tenant 1", address: "8 Hill St", tenant: "Pat" }),
  job({ business: "emporo", jobId: "e".repeat(32), status: "Quoting", address: "1 Bay St", tenant: "Alex" }),
];

test("note groups follow the Slack channel filters and put Emoro first", () => {
  const progress = jobsInGroup(sample, "progress", today);
  assert.deepEqual(progress.map((item) => item.jobId[0]), ["a", "b"]);
  assert.equal(inProgressToday(sample[2]!, today), false);
  assert.deepEqual(jobsInGroup(sample, "contacting", today).map((item) => item.status), ["Contacting Tenant 1"]);
  assert.equal(jobsInGroup(sample, "active", today).length, 5);
  assert.equal(jobsInGroup(sample, "chore", today).length, 0);
  assert.equal(noteJobLabel(sample[1]!), "🟠 Emoro · 12 Smith St · Sam");
  assert.equal(noteJobLabel(sample[0]!), "🔵 Emporo · 9 River St · Lee");
});

test("a spoken day becomes a Melbourne date and the wording stays", () => {
  assert.equal(resolveNoteDate("明天", now), "2026-11-26");
  assert.equal(resolveNoteDate("Friday", now), "2026-11-27");
  const parsed = normaliseNote(
    {
      materials: [{ item: "生料带", qty: "2", cost_aud: 8.5, store: "Bunnings" }, { item: "" }],
      tools_to_bring: ["梯子"],
      notes: ["厨房漏水"],
      todos: [{ text: "买胶", due: "明天" }],
    },
    now,
  );
  assert.equal(parsed.materials[0]?.item, "生料带");
  assert.equal(parsed.materials[0]?.costAud, 8.5);
  assert.deepEqual(parsed.tools, ["梯子"]);
  assert.equal(parsed.todos[0]?.due, "2026-11-26");
  assert.equal(noteCost(parsed.materials), 8.5);
});

test("a note maps onto the new database and not the Jobs properties", () => {
  const properties = noteNotionProperties({
    title: "生料带",
    text: "买生料带",
    jobId: "a".repeat(32),
    type: "job",
    needsReview: true,
    draft: true,
    materials: [{ item: "生料带", qty: "1", costAud: 8.5, store: "" }],
    tools: [],
    notes: [],
    todos: [],
  });
  assert.deepEqual(Object.keys(properties), [...notePropertyNames]);
  assert.equal("Status" in properties, false);
  assert.equal("Scheduled Date" in properties, false);
  const job = properties.Job as { rich_text: Array<{ text: { content: string } }> };
  assert.equal(job.rich_text[0]?.text.content, "a".repeat(32));
  assert.equal((properties.Cost as { number: number }).number, 8.5);
  assert.equal((properties.Review as { checkbox: boolean }).checkbox, true);
});

test("skipping the picker suggests one matching job and ignores a tie", () => {
  assert.equal(guessNoteJob("need tape at 12 Smith", sample)?.jobId, "a".repeat(32));
  assert.equal(guessNoteJob("Smith and River", sample), null);
  assert.equal(noteSecretOk("short", "a-long-enough-secret-value"), false);
  assert.equal(noteSecretOk("a-long-enough-secret-value", "a-long-enough-secret-value"), true);
});

test("the note page is its own home screen and is not on the jobs home", () => {
  const home = readFileSync(new URL("../src/components/jobs/home-screen.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/jobs/note/page.tsx", import.meta.url), "utf8");
  const manifest = readFileSync(new URL("../public/jobs/note/manifest.webmanifest", import.meta.url), "utf8");
  const menu = readFileSync(new URL("../src/lib/content.ts", import.meta.url), "utf8");
  assert.equal(home.includes("/jobs/note"), false);
  assert.equal(home.includes("随手记"), false);
  assert.equal(menu.includes("/jobs/note"), false);
  assert.match(page, /applicationName: "随手记"/);
  assert.match(page, /<Authed>/);
  assert.match(manifest, /"name": "随手记"/);
  assert.match(manifest, /"start_url": "\/jobs\/note"/);
  const screen = readFileSync(new URL("../src/components/jobs/note-screen.tsx", import.meta.url), "utf8");
  assert.match(screen, /Choose a job/);
  assert.match(screen, /Not job-related/);
  assert.match(screen, /Leave it/);
});
