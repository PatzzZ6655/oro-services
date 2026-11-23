import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/app/internal/(portal)/page.tsx", import.meta.url), "utf8");
const drive = readFileSync(new URL("../src/lib/reports/drive.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

test("the staff home paints the shell before the Drive list", () => {
  const hubStart = page.indexOf("async function Hub");
  const hubEnd = page.indexOf("const fieldJobTiles");
  const hub = page.slice(hubStart, hubEnd);
  assert.match(hub, /await requireUser\(\)/);
  assert.match(hub, /<PortalFrame/);
  assert.equal(hub.includes("recentReports"), false);
  assert.equal(hub.includes("listRecentReports"), false);
  assert.equal(hub.includes("listCachedRecentReports"), false);
  assert.match(page, /<Suspense fallback=\{<RecentReportsPlaceholder \/>\}>/);
  assert.match(page, /Loading recent reports…/);
  assert.match(page, /await connection\(\)/);
  assert.match(page, /await listCachedRecentReports\(\)/);
  assert.equal(page.includes("tape.orosvc.com"), false);
  assert.match(page, /requireUser/);
});

test("the recent Drive list is cached for under a minute", () => {
  assert.match(drive, /recentReportsCacheSeconds = 45/);
  assert.match(drive, /unstable_cache\(listRecentReports, \["oro-recent-reports"\], \{\s*revalidate: recentReportsCacheSeconds,\s*\}\)/);
  assert.match(drive, /export async function listRecentReports/);
});

test("functions are pinned to a single Sydney region", () => {
  const parsed = JSON.parse(config) as { regions?: string[] };
  assert.deepEqual(parsed.regions, ["syd1"]);
});
