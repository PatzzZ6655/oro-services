import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { indexablePaths, menuLinks } from "@/lib/content";
import { australianSmsNumber, smsLinkResponse } from "@/lib/sms-link";

test("an Australian mobile or landline becomes an sms number", () => {
  assert.equal(australianSmsNumber("+61421075652"), "+61421075652");
  assert.equal(australianSmsNumber("0421075652"), "+61421075652");
  assert.equal(australianSmsNumber("0421 075 652"), "+61421075652");
  assert.equal(australianSmsNumber("(03) 9123 4567"), "+61391234567");
  assert.equal(australianSmsNumber("+61 7 3123 4567"), "+61731234567");
  assert.equal(australianSmsNumber("0891234567"), "+61891234567");
});

test("anything that is not one Australian number is rejected", () => {
  const rejected = [
    "",
    "123",
    "1300123456",
    "1800123456",
    "+14155552671",
    "https://evil.example",
    "sms:+61421075652",
    "+61421075652 https://evil.example",
    "+614210756521",
    "041234567",
    "javascript:alert(1)",
    "//evil.example",
  ];
  for (const value of rejected) assert.equal(australianSmsNumber(value), null, value);
});

test("the public sms page redirects only to the checked number", async () => {
  const ok = smsLinkResponse("https://www.orosvc.com/sms?to=%2B61421075652");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.equal(ok.headers.get("x-robots-tag"), "noindex, nofollow");
  const html = await ok.text();
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /content="0;url=sms:\+61421075652"/);
  assert.match(html, /location\.replace\("sms:\+61421075652"\)/);
  assert.match(html, />Open Messages</);
  assert.equal(html.includes("gtag"), false);
  assert.equal(html.includes("analytics"), false);

  const local = smsLinkResponse("https://www.orosvc.com/sms?to=0421075652");
  assert.equal(local.status, 200);
  assert.match(await local.text(), /sms:\+61421075652/);

  const bad = smsLinkResponse("https://www.orosvc.com/sms?to=https%3A%2F%2Fevil.example");
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("cache-control"), "no-store");
  const message = await bad.text();
  assert.equal(message.includes("evil.example"), false);
  assert.equal(message.includes("sms:"), false);

  assert.equal(indexablePaths().some((entry) => entry.path.startsWith("/sms")), false);
  assert.equal(menuLinks.some((link) => String(link.href).includes("/sms")), false);
  const robots = readFileSync(new URL("../src/app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /\/sms/);
  const route = readFileSync(new URL("../src/app/sms/route.ts", import.meta.url), "utf8");
  assert.match(route, /await connection\(\)/);
  assert.equal(route.includes("requireJobsUser"), false);
  assert.equal(route.includes("console."), false);
});
