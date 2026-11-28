import assert from "node:assert/strict";
import test from "node:test";
import { linkedContactIds, loadJob } from "@/lib/jobs-app/job-record";

const jobId = "41e91037f9ca81d997f9c197986d26fe";
const contactId = "42691037-f9ca-81e4-bf00-f7d7a010e4ec";

function title(text: string) {
  return { title: [{ plain_text: text }] };
}

function page(properties: Record<string, unknown>, id = jobId) {
  return new Response(JSON.stringify({ id, properties }), { status: 200, headers: { "content-type": "application/json" } });
}

test("linked contact ids come from the job relation", () => {
  const linked = linkedContactIds({ relation: [{ id: contactId }, { id: contactId }], has_more: false });
  assert.deepEqual(linked.ids, [contactId]);
  assert.equal(linked.hasMore, false);
});

test("a contact linked on the job still shows when the contacts query is empty", async () => {
  const previous = process.env.NOTION_TOKEN;
  process.env.NOTION_TOKEN = "test-token";
  const calls: string[] = [];
  try {
    const loaded = await loadJob("emoro", jobId, async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith(`/pages/${jobId}`)) {
        return page({
          Job: title("TEST job"),
          Status: { select: { name: "Cancelled" } },
          "Property Address (rollup)": { rollup: { array: [title("TEST – 1 Test Street, Testville VIC 3000")] } },
          Contacts: { relation: [{ id: contactId }], has_more: false },
        });
      }
      if (url.includes("/query")) return new Response(JSON.stringify({ results: [] }), { status: 200 });
      if (url.endsWith(`/pages/${contactId}`)) {
        return page({
          Name: title("TEST Lumi Contact"),
          Phone: { phone_number: "+61430016655" },
          Email: { email: null },
          Select: { select: { name: "Tenant" } },
          "Google Contact Status": { select: { name: "saved" } },
        }, contactId);
      }
      return new Response("missing", { status: 404 });
    });
    assert.equal(loaded.ok, true);
    if (!loaded.ok) return;
    assert.equal(loaded.job.status, "Cancelled");
    assert.equal(loaded.job.contacts.length, 1);
    assert.equal(loaded.job.contacts[0]?.name, "TEST Lumi Contact");
    assert.equal(loaded.job.contacts[0]?.phone, "+61430016655");
    assert.equal(loaded.job.contacts[0]?.googleStatus, "saved");
    assert.equal(calls.some((call) => call.includes("/query")), false);
  } finally {
    if (previous === undefined) delete process.env.NOTION_TOKEN;
    else process.env.NOTION_TOKEN = previous;
  }
});

test("a failed contacts query is an error when the job relation is empty", async () => {
  const previous = process.env.NOTION_TOKEN;
  process.env.NOTION_TOKEN = "test-token";
  try {
    const loaded = await loadJob("emoro", jobId, async (url) => {
      if (url.endsWith(`/pages/${jobId}`)) return page({ Job: title("TEST"), Contacts: { relation: [] } });
      if (url.includes("/query")) return new Response(JSON.stringify({ message: "validation_error" }), { status: 400 });
      return new Response("missing", { status: 404 });
    });
    assert.equal(loaded.ok, false);
    if (loaded.ok) return;
    assert.equal(loaded.message, "The contacts could not be read.");
  } finally {
    if (previous === undefined) delete process.env.NOTION_TOKEN;
    else process.env.NOTION_TOKEN = previous;
  }
});
