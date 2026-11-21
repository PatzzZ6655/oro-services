import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { brands } from "@/lib/content";

const emporoLine =
  "Emporo delivers residential and commercial plumbing, gas fitting, pipe relining and drainage solutions.";

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else if (/\.(ts|tsx|md|txt)$/.test(entry)) found.push(path);
  }
  return found;
}

test("Emporo copy no longer lists taps and toilets", () => {
  const root = new URL("..", import.meta.url).pathname;
  const sources = filesUnder(join(root, "src"));
  const phrase = /taps and toilets|Taps, Toilets/i;
  const hits = sources.filter((file) => phrase.test(readFileSync(file, "utf8")));
  assert.deepEqual(hits, []);

  const emporo = brands.find((brand) => brand.id === "emporo");
  assert.equal(emporo?.description, emporoLine);
  assert.equal(emporo?.services.some((service) => /taps|toilets/i.test(service.name + service.summary)), false);
  assert.equal(emporo?.services.find((service) => service.slug === "taps-toilets-pipe-relining")?.name, "Pipe Relining");

  const hero = readFileSync(join(root, "src/components/hero.tsx"), "utf8");
  assert.equal(hero.includes(emporoLine), true);
  assert.equal(hero.includes("Emoro does construction, renovations, fit-outs, and project management."), true);

  const about = readFileSync(join(root, "src/components/about-section.tsx"), "utf8");
  assert.equal(about.includes("ORO Services runs two trades."), false);
  const brandsSection = readFileSync(join(root, "src/components/brands-section.tsx"), "utf8");
  assert.equal(brandsSection.includes("Emoro Building for construction."), false);

  const serviceView = readFileSync(join(root, "src/components/service-view.tsx"), "utf8");
  assert.equal(serviceView.includes("brand.description"), false);
  assert.equal(serviceView.includes("This work is carried out by"), true);
});
