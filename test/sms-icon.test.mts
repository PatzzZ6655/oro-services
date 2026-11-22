import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function pngSize(file: string): { width: number; height: number; green: boolean } {
  const png = readFileSync(new URL(file, import.meta.url));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png[25], 2);
  assert.equal(png.includes(Buffer.from("tRNS")), false);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  return { width, height, green: true };
}

test("the SMS home screen icon is its own green app and the staff icon is unchanged", () => {
  const staff = JSON.parse(readFileSync(new URL("../public/internal/manifest.webmanifest", import.meta.url), "utf8")) as {
    name: string;
    short_name: string;
    start_url: string;
  };
  assert.equal(staff.name, "ORO Staff");
  assert.equal(staff.short_name, "ORO");
  assert.equal(staff.start_url, "/internal");

  const sms = JSON.parse(readFileSync(new URL("../public/internal/sms/manifest.webmanifest", import.meta.url), "utf8")) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
  };
  assert.equal(sms.name, "SMS");
  assert.equal(sms.short_name, "SMS");
  assert.equal(sms.start_url, "/internal/sms-reply");
  assert.equal(sms.scope, "/internal/sms-reply");
  assert.equal(sms.display, "standalone");

  for (const [file, size] of [
    ["../public/internal/sms/icon-192.png", 192],
    ["../public/internal/sms/icon-512.png", 512],
    ["../public/internal/sms/apple-touch-icon.png", 180],
  ] as const) {
    const info = pngSize(file);
    assert.equal(info.width, size);
    assert.equal(info.height, size);
  }
  const apple = readFileSync(new URL("../public/internal/sms/apple-touch-icon.png", import.meta.url));
  const staffIcon = readFileSync(new URL("../public/internal/icons/apple-touch-icon.png", import.meta.url));
  assert.equal(apple.equals(staffIcon), false);

  const page = readFileSync(new URL("../src/app/internal/(portal)/sms-reply/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/internal/layout.tsx", import.meta.url), "utf8");
  assert.match(page, /title: "SMS"/);
  assert.match(page, /\/internal\/sms\/apple-touch-icon\.png/);
  assert.match(page, /\/internal\/sms\/manifest\.webmanifest/);
  assert.match(layout, /title: "ORO Staff"/);
  assert.match(layout, /\/internal\/icons\/apple-touch-icon\.png/);
  assert.equal(layout.includes("/internal/sms/"), false);
});
