import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/app/internal/(portal)/page.tsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("../src/components/internal/portal-frame.tsx", import.meta.url), "utf8");
const expression = headerSource.match(/function showFieldJobs\(email: string\): boolean \{\n  return ([\s\S]*?);\n\}/);

test("the job web app entry is limited to Pat on the server", () => {
  assert.ok(expression);
  const show = new Function("email", `return ${expression?.[1]};`) as (email: string) => boolean;
  assert.equal(show("pat.z@orosvc.com"), true);
  assert.equal(show("  Pat.Z@OROSVC.COM "), true);
  assert.equal(show("staff.example@orosvc.com"), false);
  assert.equal(show(""), false);
  assert.match(source, /\{showFieldJobs\(user\.email\) \? <NewJobTile \/> : null\}/);
  assert.match(source, /href="\/internal\/jobs"/);
  assert.equal(headerSource.includes("showFieldJobs(email)"), false);
  assert.equal(headerSource.includes("orosvc.com/jobs"), false);
  const start = source.indexOf("function NewJobTile");
  const tile = source.slice(start, source.indexOf("async function recentReports"));
  assert.match(tile, /href="https:\/\/www\.orosvc\.com\/jobs\/new"/);
  assert.match(tile, />New Job</);
  assert.match(tile, /Create a job/);
  assert.equal(tile.includes("ORO Jobs"), false);
  assert.equal(/[\u3400-\u9fff]/.test(tile), false);
  assert.equal(tile.includes("tape.orosvc.com"), false);
  assert.equal(tile.includes("target="), false);
  assert.equal(/[\u3400-\u9fff]/.test(headerSource), false);
});

test("the staff header can leave the portal without a homepage redirect", () => {
  const header = readFileSync(new URL("../src/components/internal/portal-frame.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(header, /const publicHome = "https:\/\/www\.orosvc\.com\/"/);
  assert.match(header, /<a href=\{publicHome\}[\s\S]*<LogoImage/);
  assert.equal(header.includes(">Home<"), false);
  assert.equal((header.match(/href=\{publicHome\}/g) ?? []).length, 1);
  assert.match(header, /min-h-11[\s\S]*pointer-events-none h-10 w-auto/);
  assert.equal(home.includes('redirect("/internal")'), false);
  assert.equal(home.includes("redirect("), false);
});
