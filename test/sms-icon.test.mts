import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

function pngSize(file: string): { width: number; height: number; green: boolean } {
  const png = readFileSync(new URL(file, import.meta.url));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png[25], 2);
  assert.equal(png.includes(Buffer.from("tRNS")), false);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  return { width, height, green: true };
}

function cornerGreen(png: Buffer): { top: number[]; bottom: number[] } {
  let off = 8;
  const parts: Buffer[] = [];
  let width = 0;
  let height = 0;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.subarray(off + 4, off + 8).toString();
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") parts.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 3;
  const rows: Buffer[] = [];
  let cursor = 0;
  const paeth = (a: number, b: number, c: number) => {
    const pa = Math.abs(b - c);
    const pb = Math.abs(a - c);
    const pc = Math.abs(a + b - 2 * c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const row = Buffer.alloc(stride);
    const prev = rows[y - 1] ?? Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const value = raw[cursor];
      cursor += 1;
      const left = i >= 3 ? row[i - 3] : 0;
      const up = prev[i];
      const upLeft = i >= 3 ? prev[i - 3] : 0;
      let next = value;
      if (filter === 1) next = (value + left) & 255;
      else if (filter === 2) next = (value + up) & 255;
      else if (filter === 3) next = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) next = (value + paeth(left, up, upLeft)) & 255;
      row[i] = next;
    }
    rows.push(row);
  }
  const bottom = rows[height - 1];
  return {
    top: [rows[0][0], rows[0][1], rows[0][2]],
    bottom: [bottom[0], bottom[1], bottom[2]],
  };
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
  const large = readFileSync(new URL("../public/internal/sms/icon-512.png", import.meta.url));
  const green = cornerGreen(large);
  assert.ok(green.top[1] >= 190 && green.top[1] <= 215, `top green ${green.top}`);
  assert.ok(green.bottom[1] >= 190 && green.bottom[1] <= 220, `bottom green ${green.bottom}`);
  assert.ok(green.bottom[0] >= 40, `bottom is too dark ${green.bottom}`);

  const page = readFileSync(new URL("../src/app/internal/(portal)/sms-reply/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/internal/layout.tsx", import.meta.url), "utf8");
  assert.match(page, /title: "SMS"/);
  assert.match(page, /\/internal\/sms\/apple-touch-icon\.png/);
  assert.match(page, /\/internal\/sms\/manifest\.webmanifest/);
  assert.match(layout, /title: "ORO Staff"/);
  assert.match(layout, /\/internal\/icons\/apple-touch-icon\.png/);
  assert.equal(layout.includes("/internal/sms/"), false);
});
