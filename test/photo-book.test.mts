import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addPhotoIssue,
  attachPhotoFile,
  collageLayout,
  collageReady,
  emptyPhotoBook,
  initialAreaSection,
  issuePlace,
  maxPhotoAngles,
  areaGroups,
  interiorAreas,
  photoAreaPresets,
  photoFileName,
  photoFolderName,
  photoLevels,
  photoTakenStamp,
  resolveArea,
  swapAfterPhotos,
  unshotAngles,
} from "@/lib/jobs-app/photo-book";
import { storePhotoBytes } from "@/lib/jobs-app/photo-drive";

test("levels come first and bedrooms can be numbered", () => {
  assert.deepEqual(photoLevels, ["Ground Floor", "First Floor (Upstairs)", "Second Floor", "Basement", "Exterior/Outside"]);
  assert.equal((photoAreaPresets as readonly string[]).includes("Bedroom"), false);
  assert.equal(photoAreaPresets.includes("Master Bedroom"), true);
  assert.equal(photoAreaPresets.includes("Ensuite"), true);
  assert.equal(photoAreaPresets.includes("Living Room"), true);
  assert.equal(photoAreaPresets.includes("Porch/Verandah"), true);
  assert.equal(photoAreaPresets.includes("Entry/Foyer"), true);
  assert.equal(interiorAreas[0], "Bathroom");
  assert.equal(resolveArea("Other Bedrooms", "Bedroom 3"), "Bedroom 3");
  assert.equal("error" in (resolveArea("Other", "  ") as { error: string }), true);
  assert.equal(areaGroups("Ground Floor")[0]?.title, "Interior");
  assert.equal(areaGroups("Exterior/Outside")[0]?.title, "Exterior");
  assert.equal(areaGroups("Exterior/Outside")[0]?.areas[0], "Porch/Verandah");
  assert.equal(initialAreaSection("Exterior/Outside"), "Exterior");
  assert.equal(initialAreaSection("Ground Floor"), "");
  const taken = new Date(2026, 10, 28, 14, 30).getTime();
  assert.equal(photoTakenStamp(new Uint8Array(), taken), "2026-11-28-1430");
  assert.equal(photoFileName("Ground Floor", "Kitchen", "before", 0, "2026-11-28-1430"), "Ground Floor Kitchen before 1 2026-11-28-1430.jpg");
});

test("an issue keeps at most four angles and flags an unshot after", () => {
  const jobId = "a".repeat(32);
  let book = emptyPhotoBook("emoro", jobId, "TEST job");
  const created = addPhotoIssue(book, "Ground Floor", "Kitchen", "  leaking tap  ", "issue-001");
  if ("error" in created) throw new Error(created.error);
  book = created;
  for (let index = 0; index < maxPhotoAngles; index += 1) {
    const next = attachPhotoFile(book, { issueId: "issue-001", angleId: `angle-00${index}`, side: "before", fileId: `beforefile${index}` });
    if ("error" in next) throw new Error(next.error);
    book = next;
  }
  const extra = attachPhotoFile(book, { issueId: "issue-001", angleId: "angle-009", side: "before", fileId: "beforefile9" });
  assert.equal("error" in extra, true);
  const issue = book.issues[0];
  if (!issue) throw new Error("missing issue");
  assert.equal(unshotAngles(issue).length, 4);
  assert.equal(collageReady(issue), false);
  const onlyAfter = attachPhotoFile(created, { issueId: "issue-001", angleId: "angle-only", side: "after", fileId: "afteronly01" });
  if ("error" in onlyAfter) throw new Error(onlyAfter.error);
  assert.equal(onlyAfter.issues[0]?.angles[0]?.beforeId, "");
  assert.equal(collageReady(onlyAfter.issues[0]!), false);
  const pairedOne = attachPhotoFile(onlyAfter, { issueId: "issue-001", angleId: "angle-only", side: "before", fileId: "beforeonly1" });
  if ("error" in pairedOne) throw new Error(pairedOne.error);
  assert.equal(collageReady(pairedOne.issues[0]!), true);
  const noNote = addPhotoIssue(emptyPhotoBook("emoro", jobId, "TEST job"), "Ground Floor", "Kitchen", "", "issue-002");
  assert.equal("error" in noNote, false);
  const paired = attachPhotoFile(book, { issueId: "issue-001", angleId: "angle-000", side: "after", fileId: "afterfile00" });
  if ("error" in paired) throw new Error(paired.error);
  const swapped = swapAfterPhotos(paired, "issue-001", "angle-000", "angle-001");
  if ("error" in swapped) throw new Error(swapped.error);
  assert.equal(swapped.issues[0]?.angles[0]?.afterId, "");
  assert.equal(swapped.issues[0]?.angles[1]?.afterId, "afterfile00");
  assert.equal(photoFolderName("TEST – shortcut buttons (Emoro)"), "TEST – shortcut buttons (Emoro)");
  assert.equal(issuePlace({ level: "Ground Floor", area: "Kitchen" }), "Ground Floor · Kitchen");
  assert.equal(photoFileName("Ground Floor", "Bedroom 2", "before", 0), "Ground Floor Bedroom 2 before 1.jpg");
  assert.equal(photoFileName("First Floor (Upstairs)", "Ensuite", "collage", 0), "First Floor (Upstairs) Ensuite collage.jpg");
  const layout = collageLayout(2);
  assert.deepEqual(layout.cells.map((cell) => cell.label), ["BEFORE", "AFTER", "BEFORE", "AFTER"]);
  assert.equal(JSON.stringify(layout).includes("Test Street"), false);
});

test("photo uploads go to ORO Before-After and do not touch report folders", async () => {
  const previous = {
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  };
  process.env.GOOGLE_CLIENT_ID = "client";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = "r".repeat(30);
  const calls: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  try {
    const book = addPhotoIssue(emptyPhotoBook("emoro", "b".repeat(32), "TEST job"), "Ground Floor", "Kitchen", "leaking tap", "issue-001");
    if ("error" in book) throw new Error(book.error);
    await storePhotoBytes(book, { issueId: "issue-001", angleId: "angle-001", side: "before", bytes: Uint8Array.of(1, 2, 3), name: "before-angle-001.jpg" }, async (url, init) => {
      const target = String(url);
      const raw = init?.body instanceof Uint8Array ? new TextDecoder().decode(init.body) : typeof init?.body === "string" ? init.body : "";
      calls.push(`${init?.method ?? "GET"} ${target} ${raw}`);
      if (target.includes("oauth2.googleapis.com")) return json({ access_token: "token" });
      if (init?.method === "POST" || init?.method === "PATCH") return json({ id: "drivefile1" });
      return json({ files: [] });
    });
  } finally {
    process.env.GOOGLE_CLIENT_ID = previous.id;
    process.env.GOOGLE_CLIENT_SECRET = previous.secret;
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = previous.refresh;
  }
  const joined = calls.join("\n");
  assert.match(joined, /ORO Before-After/);
  assert.match(joined, /oro-photos/);
  assert.equal(joined.includes("ORO Reports"), false);
  assert.equal(joined.includes("/permissions"), false);
});

test("the photos page is its own installable app and the camera policy is scoped", () => {
  const home = readFileSync(new URL("../src/components/jobs/home-screen.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/jobs/photos/page.tsx", import.meta.url), "utf8");
  const manifest = readFileSync(new URL("../public/jobs/photos/manifest.webmanifest", import.meta.url), "utf8");
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(home, /href="\/jobs\/photos"/);
  assert.equal(home.includes("/jobs/note"), false);
  assert.match(page, /applicationName: "ORO Photos"/);
  assert.match(page, /<Authed>/);
  assert.match(manifest, /"name": "ORO Photos"/);
  assert.match(manifest, /"start_url": "\/jobs\/photos"/);
  assert.match(config, /"camera=\(\)"/);
  assert.match(config, /source: "\/jobs\/photos"/);
  assert.match(config, /camera=\(self\)/);
  const upload = readFileSync(new URL("../src/app/jobs/api/photos/upload/route.ts", import.meta.url), "utf8");
  const collage = readFileSync(new URL("../src/components/jobs/photo-collage.ts", import.meta.url), "utf8");
  assert.match(upload, /photoFileName/);
  const screen = readFileSync(new URL("../src/components/jobs/photos-screen.tsx", import.meta.url), "utf8");
  assert.match(screen, /KeepPage/);
  assert.match(screen, /Add another angle/);
  assert.match(screen, /Next issue/);
  assert.match(screen, /Choose from library/);
  assert.match(screen, /Add Before/);
  assert.equal(screen.includes("Short note for this issue"), false);
  assert.equal(collage.includes("issuePlace"), false);
  assert.equal(collage.includes("level"), false);
});
