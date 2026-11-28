import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addPhotos, LEAVE_MAX_PHOTOS, NEW_JOB_MAX_IMAGES } from "@/lib/jobs-app/photos";

function image(name: string): File {
  return new File([Uint8Array.of(1)], name, { type: "image/jpeg" });
}

test("later photos are kept with the ones already taken", () => {
  const first = addPhotos([], [image("one.jpg")], NEW_JOB_MAX_IMAGES);
  const second = addPhotos(first, [image("two.jpg"), new File([Uint8Array.of(2)], "note.txt", { type: "text/plain" })], NEW_JOB_MAX_IMAGES);
  assert.deepEqual(second.map((file) => file.name), ["one.jpg", "two.jpg"]);
  const capped = addPhotos(second, [image("three.jpg"), image("four.jpg"), image("five.jpg")], NEW_JOB_MAX_IMAGES);
  assert.equal(capped.length, NEW_JOB_MAX_IMAGES);
  assert.equal(addPhotos([], [image("a.jpg")], LEAVE_MAX_PHOTOS).length, 1);
});

test("new job and leave keep shooting, and depart has no photo step", () => {
  const burst = readFileSync(new URL("../src/components/jobs/photo-burst.tsx", import.meta.url), "utf8");
  const created = readFileSync(new URL("../src/components/jobs/new-screen.tsx", import.meta.url), "utf8");
  const leave = readFileSync(new URL("../src/components/jobs/leave-screen.tsx", import.meta.url), "utf8");
  const depart = readFileSync(new URL("../src/components/jobs/depart-screen.tsx", import.meta.url), "utf8");
  assert.match(burst, /accept="image\/\*"/);
  assert.match(burst, /multiple/);
  assert.match(burst, /Take another/);
  assert.match(burst, /Take photo/);
  assert.match(burst, /Remove/);
  assert.equal(burst.includes("getUserMedia"), false);
  assert.equal(burst.includes("Use camera"), false);
  assert.match(created, /<PhotoBurst/);
  assert.match(created, /max=\{NEW_JOB_MAX_IMAGES\}/);
  assert.match(created, /onDone=\{files\.length > 0 \? continueToCheck : undefined\}/);
  assert.match(leave, /<PhotoBurst/);
  assert.match(leave, /max=\{LEAVE_MAX_PHOTOS\}/);
  assert.match(leave, /form\.append\("photos", file\)/);
  assert.equal(depart.includes('type="file"'), false);
  assert.equal(depart.includes("PhotoBurst"), false);
});
