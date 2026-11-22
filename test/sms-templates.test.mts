import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fillSmsTemplate, smsTemplates } from "@/lib/sms-templates";

const sample = {
  name: "Test Tenant",
  address: "12 Test Street",
  day: "Tuesday",
  time: "9am",
  brand: "Emoro Building",
};

test("the starter templates keep a Chinese label and an English base", () => {
  assert.deepEqual(
    smsTemplates.map((template) => template.label),
    ["第一次约时间", "第二次约时间/再次确认", "去办公室取钥匙", "还钥匙", "明天到达提醒", "改期"],
  );
  for (const template of smsTemplates) {
    assert.equal(template.intent.includes(template.label.split("/")[0] ?? template.label) || template.label.startsWith(template.intent) || template.intent.length > 0, true);
    assert.match(template.english, /\{name\}/);
    assert.match(template.english, /\{address\}/);
    assert.match(template.english, /\{brand\}/);
    assert.equal(template.english.includes("Dear"), false);
  }
  assert.equal(fillSmsTemplate(smsTemplates[0].english, sample), "Hi Test Tenant, Emoro Building here. We can come to 12 Test Street on Tuesday at 9am. Does that suit? Thanks! - Emoro Building");
  assert.equal(
    fillSmsTemplate(smsTemplates[1].english, sample),
    "Hi Test Tenant, Emoro Building here. Just checking again, as I haven't heard back. We can still come to 12 Test Street on Tuesday at 9am. Let me know, thanks! - Emoro Building",
  );
  assert.equal(
    fillSmsTemplate(smsTemplates[2].english, sample),
    "Hi Test Tenant, Emoro Building here. We'll pick the keys up from the office for 12 Test Street on Tuesday at 9am. Thanks! - Emoro Building",
  );
  assert.equal(fillSmsTemplate(smsTemplates[3].english, sample), "Hi Test Tenant, Emoro Building here. The keys for 12 Test Street are back at the office. Thanks! - Emoro Building");
  assert.equal(
    fillSmsTemplate(smsTemplates[4].english, sample),
    "Hi Test Tenant, Emoro Building here. Just a reminder we'll be at 12 Test Street tomorrow at 9am. See you then, thanks! - Emoro Building",
  );
  assert.equal(
    fillSmsTemplate(smsTemplates[5].english, sample),
    "Hi Test Tenant, Emoro Building here. We need to move the visit at 12 Test Street to Tuesday at 9am. Sorry about the change. Thanks! - Emoro Building",
  );
});

test("a blank name is tenant, and a missing day or time is left out", () => {
  const first = smsTemplates[0].english;
  assert.equal(
    fillSmsTemplate(first, { name: " ", address: "12 Test Street", day: "", time: "", brand: "Emporo Plumbing" }),
    "Hi tenant, Emporo Plumbing here. We can come to 12 Test Street. Does that suit? Thanks! - Emporo Plumbing",
  );
  assert.equal(
    fillSmsTemplate(first, { name: "", address: "12 Test Street", day: "Tuesday", time: "", brand: "Emoro Building" }),
    "Hi tenant, Emoro Building here. We can come to 12 Test Street on Tuesday. Does that suit? Thanks! - Emoro Building",
  );
  assert.equal(
    fillSmsTemplate(smsTemplates[4].english, { name: "", address: "", day: "", time: "", brand: "" }),
    "Hi tenant. Just a reminder we'll be at your place tomorrow. See you then, thanks!",
  );
  assert.equal(
    fillSmsTemplate(smsTemplates[5].english, { name: "Sam", address: "4 Test Road", day: "", time: "2pm", brand: "Emoro Building" }),
    "Hi Sam, Emoro Building here. We need to move the visit at 4 Test Road to 2pm. Sorry about the change. Thanks! - Emoro Building",
  );
  const form = readFileSync(new URL("../src/components/internal/sms-reply-form.tsx", import.meta.url), "utf8");
  assert.match(form, /sms-template/);
  assert.match(form, /fillSmsTemplate/);
  assert.equal(form.includes("MAKE_"), false);
  assert.equal(form.includes("/jobs/api/depart"), false);
});
