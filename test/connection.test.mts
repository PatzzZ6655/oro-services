import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { databaseConnectionString } from "@/lib/jobs/connection";

const sample = "postgres://user:p%40ss@ep-example.ap-southeast-2.aws.neon.tech/jobs";

test("aliased ssl modes become verify-full without changing the rest of the url", () => {
  assert.equal(
    databaseConnectionString(`${sample}?sslmode=require`),
    `${sample}?sslmode=verify-full`,
  );
  assert.equal(
    databaseConnectionString(`${sample}?channel_binding=require&sslmode=prefer`),
    `${sample}?channel_binding=require&sslmode=verify-full`,
  );
  assert.equal(
    databaseConnectionString(`${sample}?sslmode=verify-ca&application_name=oro`),
    `${sample}?sslmode=verify-full&application_name=oro`,
  );
  assert.equal(databaseConnectionString(`${sample}?sslmode=verify-full`), `${sample}?sslmode=verify-full`);
  assert.equal(databaseConnectionString(`${sample}?sslmode=disable`), `${sample}?sslmode=disable`);
  assert.equal(databaseConnectionString(`${sample}?sslmode=no-verify`), `${sample}?sslmode=no-verify`);
  assert.equal(databaseConnectionString(sample), sample);
});

test("an explicit verify-full connection does not emit the pg ssl warning", () => {
  const warnings: string[] = [];
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    warnings.push(typeof warning === "string" ? warning : warning.message);
    return Reflect.apply(original, process, [warning, ...rest]);
  }) as typeof process.emitWarning;
  try {
    const client = new pg.Client({
      connectionString: databaseConnectionString(`${sample}?sslmode=require`),
    });
    assert.notEqual(client.ssl, false);
    assert.equal(
      warnings.some((warning) => warning.includes("sslmode")),
      false,
    );
  } finally {
    process.emitWarning = original;
  }
});
