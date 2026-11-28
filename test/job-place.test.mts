import assert from "node:assert/strict";
import test from "node:test";
import { confidentJobTitle, normalisePropertyAddress } from "@/lib/jobs-app/job-place";

test("a property address keeps the street and a title-case suburb", () => {
  assert.equal(normalisePropertyAddress("Unit 2/57 Summit Dr, Bulleen, VIC, 3105"), "Unit 2/57 Summit Dr, Bulleen");
  assert.equal(normalisePropertyAddress("1 Main St, BOX HILL NORTH, VIC 3128"), "1 Main St, Box Hill North");
  assert.equal(normalisePropertyAddress("12 Smith St"), "12 Smith St");
  assert.equal(normalisePropertyAddress("  "), "");
});

test("a job title uses the property manager, and stays blank when that name is missing", () => {
  assert.equal(
    confidentJobTitle({
      pmName: "Sarah Jones",
      tenantName: "Sam Lee",
      address: "Unit 2/57 Summit Dr, Bulleen, VIC, 3105",
      description: "Leaking tap",
    }),
    "Sarah_ Unit 2/57 Summit Dr, Bulleen _Leaking tap",
  );
  assert.equal(
    confidentJobTitle({
      pmName: "",
      customerName: "Sam Lee",
      tenantName: "Sam Lee",
      address: "1 Main St, Bulleen",
      description: "Leaking tap",
    }),
    "",
  );
  assert.equal(
    confidentJobTitle({
      pmName: "",
      customerName: "Alex Chen",
      tenantName: "Sam Lee",
      address: "1 Main St, Bulleen",
      description: "Leaking tap",
    }),
    "Alex_ 1 Main St, Bulleen _Leaking tap",
  );
  assert.equal(
    confidentJobTitle({
      pmName: "Sarah Jones",
      tenantName: "Sam Lee",
      address: "12 Smith St",
      description: "Leaking tap",
    }),
    "",
  );
});
