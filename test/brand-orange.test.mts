import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const emoroOrange = "#ca3500";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Emoro orange is the official brand colour", () => {
  const css = source("src/app/globals.css");
  assert.match(css, /--color-brand-orange:\s*#ca3500;/);
  assert.match(css, /--color-brand-orange-hover:\s*#992800;/);
  assert.match(css, /--color-brand-blue:\s*#1e40af;/);
  assert.match(css, /--color-brand-navy:\s*#0f172a;/);
  assert.equal(css.includes("#ea580c"), false);
  assert.equal(css.includes(emoroOrange.toUpperCase()) || css.includes(emoroOrange), true);
});

test("Emoro accents use the brand hue instead of Tailwind orange", () => {
  const files = [
    "src/lib/content.ts",
    "src/components/contact-section.tsx",
    "src/components/interior-hero.tsx",
    "src/app/not-found.tsx",
  ];
  for (const file of files) {
    const text = source(file);
    assert.equal(/orange-\d+/.test(text), false, file);
    assert.equal(text.includes("#ea580c"), false, file);
  }
  const tones = source("src/lib/content.ts");
  assert.match(tones, /button: "bg-brand-orange hover:bg-brand-orange-hover"/);
  assert.match(tones, /button: "bg-brand-navy hover:bg-brand-blue"/);
});

test("report PDFs use the same Emoro orange", () => {
  for (const file of ["src/lib/reports/pdf.ts", "src/lib/reports/safety-pdf.ts"]) {
    const text = source(file);
    assert.match(text, /const orange = rgb\(202 \/ 255, 53 \/ 255, 0\);/);
    assert.match(text, /const blue = rgb\(30 \/ 255, 64 \/ 255, 175 \/ 255\);/);
    assert.equal(text.includes("234 / 255, 88 / 255, 12 / 255"), false);
  }
});
