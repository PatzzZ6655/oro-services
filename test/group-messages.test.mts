import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contactCardName, contactRole, primaryContacts, primarySelectFilter } from "@/lib/jobs-app/contact-groups";
import { contactCreateBody } from "@/lib/jobs-app/job-record";
import { contactSyncPayload, groupEmailPayload, keyPickupBody, keyPickupPayload, keyPickupSubject, neighbourImpactLines, neighbourIntro, ownerIntro, fieldsFor } from "@/lib/jobs-app/group-messages";
import { smsMessageBody } from "@/lib/sms-link";

test("a contact card uses the name, short address, and role", () => {
  assert.equal(contactCardName("Daniel", "2/57 Summit Dr, Bulleen, VIC, 3105", "tenant"), "Daniel · 2/57 Summit Dr, Bulleen · Tenant");
  assert.equal(contactRole(""), "tenant");
  assert.equal(contactRole("Neighbour"), "neighbour");
  const people = [
    { role: "neighbour" as const, name: "Pat" },
    { role: "tenant" as const, name: "Sam" },
    { role: "owner" as const, name: "Jo" },
  ];
  assert.deepEqual(primaryContacts(people).map((person) => person.name), ["Sam"]);
  assert.deepEqual(primaryContacts(people.filter((person) => person.role !== "tenant")).map((person) => person.name), ["Jo"]);
  const filter = JSON.stringify(primarySelectFilter());
  assert.match(filter, /is_empty/);
  assert.match(filter, /Tenant/);
  assert.equal(filter.includes("does_not_equal"), false);
});

test("neighbour and owner texts keep Pat's wording", () => {
  const fields = fieldsFor("Daniel", {
    brand: "Emoro Building",
    agency: "Barry Plant",
    summary: "repair the fence",
    address: "2/57 Summit Dr, Bulleen",
    duration: "half a day",
    date: "Monday",
    time: "9am",
    impact: neighbourImpactLines[1],
  });
  assert.equal(
    neighbourIntro(fields),
    "Hi Daniel, it's Pat from Emoro Building. We're doing some repair the fence at 2/57 Summit Dr, Bulleen, planned for Monday. There may be some noise while we work. Is there a time that suits, or anything we should know? Any questions, just call or text me. Thanks!",
  );
  assert.equal(
    ownerIntro(fields),
    "Hi Daniel, it's Pat from Emoro Building. Barry Plant has asked us to repair the fence at your property at 2/57 Summit Dr, Bulleen. It should take about half a day. What day and time suits you for access this week? Thanks!",
  );
  assert.equal(keyPickupSubject(fields.address, fields.brand), "Key pickup – 2/57 Summit Dr, Bulleen – Emoro Building");
  assert.match(keyPickupBody("Sarah", fields.address, "Monday", fields.brand), /Hi Sarah,/);
  assert.equal(smsMessageBody("a".repeat(301)), null);
  assert.equal(smsMessageBody("a".repeat(301), 480)?.length, 301);
});

test("the Make payloads are additive and a new contact is not linked to the property", () => {
  const key = keyPickupPayload({ business: "emoro", jobId: "a".repeat(32), address: "2/57 Summit Dr, Bulleen", brand: "Emoro Building", pmFirstName: "Sarah", pickupDate: "2026-12-01" });
  assert.equal(key.mode, "sendKeyPickupEmail");
  assert.equal(key.subject.startsWith("Key pickup –"), true);
  const email = groupEmailPayload({
    business: "emoro",
    jobId: "a".repeat(32),
    template: "n1",
    impactLine: neighbourImpactLines[0],
    address: "2/57 Summit Dr, Bulleen",
    brand: "Emoro Building",
    summary: "repair",
    date: "Monday",
    contacts: [{ name: "Daniel", email: "d@example.com", first: "Daniel" }],
  });
  assert.equal(email.mode, "sendGroupEmail");
  assert.equal(email.group, "Neighbour");
  const sync = contactSyncPayload({
    business: "emporo",
    jobId: "b".repeat(32),
    pageId: "c".repeat(32),
    name: "Daniel",
    phone: "+61430016655",
    email: "",
    role: "Tenant",
    displayName: "Daniel · 2/57 Summit Dr, Bulleen · Tenant",
  });
  assert.equal(sync.mode, "syncContact");
  assert.equal(sync.displayName, "Daniel · 2/57 Summit Dr, Bulleen · Tenant");
  const created = contactCreateBody("emoro", "a".repeat(32), { name: "Daniel", phone: "+61430016655", email: "", role: "neighbour" });
  const encoded = JSON.stringify(created);
  assert.match(encoded, /"Jobs"/);
  assert.equal(encoded.includes("Property"), false);
  assert.match(encoded, /Neighbour/);
  const notes = readFileSync(new URL("../src/lib/jobs-app/job-notes-store.ts", import.meta.url), "utf8");
  assert.match(notes, /primarySelectFilter/);
  assert.equal(notes.includes("does_not_equal"), false);
});
