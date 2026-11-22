import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dateFromChip,
  fillSmsTemplate,
  highlightSchedule,
  matchSmsTemplate,
  scheduleConflict,
  scheduleFromJob,
  smsTemplateGroups,
  smsTemplates,
  suggestTemplates,
} from "@/lib/sms-templates";

const now = new Date("2026-11-22T01:00:00.000Z");
const full = {
  name: "Test Tenant",
  pmName: "Test PM",
  brand: "Emoro Building",
  agency: "Test Agency",
  address: "12 Test Street",
  day: "Wed 25/11",
  time: "9am",
  mins: "30",
  reason: "the part has not arrived",
  issue: "water",
};

test("the ten templates keep Pat's English and drop empty brackets", () => {
  assert.deepEqual(smsTemplateGroups, ["约时间", "到场", "钥匙·物业", "特殊"]);
  assert.deepEqual(
    smsTemplates.map((template) => template.label),
    ["首次约时间", "跟进没回复", "确认预约", "到场提醒", "改期", "回来继续", "法规说明", "钥匙", "联系不上租客", "紧急报修"],
  );
  const text = (id: string, variant = "") => {
    const template = smsTemplates.find((item) => item.id === id);
    if (!template) throw new Error(id);
    const english = template.variants?.find((item) => item.id === variant)?.english ?? template.english ?? "";
    return fillSmsTemplate(english, full);
  };
  assert.equal(
    text("first-visit"),
    "Hi Test Tenant, Pat from Emoro Building here. We've got a work order from Test Agency for 12 Test Street. When suits you for us to come by? Happy to work around you, including after 5pm or weekends. Thanks!",
  );
  assert.equal(
    text("follow-up"),
    "Hi Test Tenant, Pat from Emoro Building again. Just following up on the repair at 12 Test Street. Sorry if I've called a few times. When's a good time to come by? Thanks!",
  );
  assert.equal(
    text("confirm"),
    "Hi Test Tenant, confirming we'll be at 12 Test Street on Wed 25/11 around 9am. Please reply YES, or let me know if another time suits better. Thanks, Pat – Emoro Building",
  );
  assert.equal(text("arrival", "today"), "Hi Test Tenant, Pat here. We'll be there today around 9am. See you soon!");
  assert.equal(text("arrival", "enroute"), "Hi Test Tenant, Pat here. I'm on my way, about 30 mins away. See you soon!");
  assert.equal(
    text("reschedule"),
    "Hi Test Tenant, sorry for the short notice. We can't make it today as the part has not arrived. Could we come Wed 25/11 instead: morning, early afternoon, or after 4pm? Sorry again and thanks for your patience! Pat – Emoro Building",
  );
  assert.equal(
    text("return-finish"),
    "Hi Test Tenant, we'll be back on Wed 25/11 around 9am to finish the job at 12 Test Street. Thanks for your patience! Pat – Emoro Building",
  );
  assert.equal(text("rental-law"), "Hi Test Tenant, this is required under the new Victorian rental laws, so the owner needs to have it fixed. Thanks for understanding.");
  assert.equal(text("keys", "collect"), "Hi Test PM, when's a good time to pick up the keys for 12 Test Street? Thanks, Pat – Emoro Building");
  assert.equal(text("keys", "return"), "Hi Test PM, the job at 12 Test Street is complete and the keys are back at your office. Thanks, Pat – Emoro Building");
  assert.equal(
    text("cant-reach"),
    "Hi Test PM, quick update on 12 Test Street. I've tried the tenant a few times with no luck. Could you help me get in touch with them? Keen to get it done ASAP. Cheers, Pat – Emoro Building",
  );
  assert.equal(
    text("emergency"),
    "Hi Test PM, got your request about the emergency at 12 Test Street. I can attend 9am. In the meantime, if it's a water issue, please ask the tenant to turn off the main. I'll update you once I'm on site. Thanks, Pat – Emoro Building",
  );
  const blank = fillSmsTemplate(smsTemplates[0]?.english ?? "", { ...full, name: "", brand: "", agency: "", address: "" });
  assert.equal(blank.includes("["), false);
  assert.match(blank, /Hi tenant, Pat here/);
  assert.equal(fillSmsTemplate(smsTemplates.find((item) => item.id === "arrival")?.variants?.[1]?.english ?? "", { ...full, mins: "" }).includes("["), false);
});

test("a job stage suggests a few templates, and the Chinese note can pick one", () => {
  assert.deepEqual(suggestTemplates("New Work Order").map((item) => item.id), ["first-visit", "follow-up"]);
  assert.deepEqual(suggestTemplates("Contacting Tenant 3 Cc PM").map((item) => item.id), ["cant-reach", "follow-up"]);
  assert.deepEqual(suggestTemplates("Time Confirming").map((item) => item.id), ["confirm", "arrival", "reschedule"]);
  assert.deepEqual(suggestTemplates("In Progress").map((item) => item.id), ["arrival", "confirm"]);
  assert.equal(suggestTemplates("In Progress (Collect Key)")[0]?.variant, "collect");
  assert.equal(suggestTemplates("In Progress (Return Key)")[0]?.variant, "return");
  assert.equal(suggestTemplates("Job Key Appointing")[0]?.variant, "collect");
  assert.deepEqual(suggestTemplates("Contacting tenant").map((item) => item.id), ["first-visit", "follow-up", "cant-reach"]);
  assert.deepEqual(suggestTemplates("Scheduled").map((item) => item.id), ["confirm", "arrival", "keys"]);
  assert.equal(suggestTemplates("On the way")[0]?.variant, "enroute");
  assert.equal(suggestTemplates("Completed")[0]?.variant, "return");
  assert.deepEqual(matchSmsTemplate("跟进没回复"), { id: "follow-up", variant: "" });
  assert.deepEqual(matchSmsTemplate("我在路上"), { id: "arrival", variant: "enroute" });
  assert.equal(matchSmsTemplate(""), null);
  assert.equal(dateFromChip("tomorrow", now), "Mon 23/11");
  assert.equal(dateFromChip("wed", now), "Wed 25/11");
  assert.deepEqual(scheduleFromJob("2026-11-25T09:00:00+11:00", now), { dateKey: "wed", dateLabel: "Wed 25/11", time: "9am" });
  assert.equal(scheduleConflict("下午3点过来", { dateKey: "wed", time: "9am" }).includes("3pm"), true);
  assert.equal(scheduleConflict("上午9点", { dateKey: "today", time: "9am" }), "");
  assert.equal(highlightSchedule("See you on Wed 25/11 around 9am.").some((part) => part.mark && part.text === "Wed 25/11"), true);
  const form = readFileSync(new URL("../src/components/internal/sms-reply-form.tsx", import.meta.url), "utf8");
  assert.match(form, /optgroup/);
  assert.match(form, /smsTemplateGroups/);
  assert.match(form, /Suggested for this job/);
  assert.equal(form.includes("/jobs/api/depart"), false);
});
