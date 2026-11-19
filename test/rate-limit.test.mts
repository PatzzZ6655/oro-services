import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newDb } from "pg-mem";
import {
  allowFromMemory,
  rateLimitKey,
  recordSharedHit,
  resetEnquiryLimits,
  type RateQuery,
} from "@/lib/rate-limit";

function memoryQuery(): RateQuery {
  const db = newDb();
  db.public.none(`
    CREATE TABLE enquiry_rate (
      ip text NOT NULL,
      at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  return async (text, params = []) => {
    const result = await pool.query(text, params);
    return result.rows as Array<{ n?: number | string }>;
  };
}

test("one address is limited without blocking a different address", () => {
  resetEnquiryLimits();
  for (let i = 0; i < 5; i += 1) assert.equal(allowFromMemory("203.0.113.5"), true);
  assert.equal(allowFromMemory("203.0.113.5"), false);
  assert.equal(allowFromMemory("203.0.113.9"), true);
  assert.equal(rateLimitKey(""), null);
  assert.equal(rateLimitKey("unknown"), null);
});

test("the shared table limits one address and leaves others alone", async () => {
  const query = memoryQuery();
  for (let i = 0; i < 5; i += 1) assert.equal(await recordSharedHit(query, "203.0.113.5"), true);
  assert.equal(await recordSharedHit(query, "203.0.113.5"), false);
  assert.equal(await recordSharedHit(query, "203.0.113.9"), true);
});

test("portal pages share one sign-in check and the login page does not", () => {
  const layout = readFileSync(new URL("../src/app/internal/(portal)/layout.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../src/app/internal/login/page.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../src/app/contact/actions.ts", import.meta.url), "utf8");
  assert.match(layout, /await requireUser\(\)/);
  assert.equal(login.includes("requireUser"), false);
  assert.match(actions, /enquiry_email_failed/);
  assert.match(actions, /await allowEnquiry/);
});
