import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClarificationOptions,
  normalizeResearchInput,
  safeCandidate,
} from "../src/research-contract.js";

test("research input requires only full name", () => {
  assert.deepEqual(
    normalizeResearchInput({ fullName: " Іваненко   Іван " }),
    {
      fullName: "Іваненко Іван",
      organization: null,
      position: null,
      city: null,
      birthDate: null,
    },
  );
});

test("candidate payload exposes safe identity attributes", () => {
  const result = safeCandidate({
    id: "candidate-1",
    canonical_name: "Іваненко Іван Іванович",
    identifiers: [{ type: "tax_number", value: "secret" }],
    facts: [
      { type: "organization", value: "КМДА" },
      { type: "position", value: "Директор" },
      { type: "city", value: "Київ" },
      { type: "birth_date", value: "1980-01-02" },
    ],
  }, {
    score: 85,
    level: "confirmed",
    reasons: ["Точний збіг"],
  });

  assert.equal(result.organization, "КМДА");
  assert.equal(result.birthDate, "1980-01-02");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("clarification dropdown options are derived and deduplicated", () => {
  const result = buildClarificationOptions([
    { organization: "КМДА", position: "Директор", city: "Київ", birthDate: "1980-01-02" },
    { organization: "кмда", position: "Радник", city: "Львів", birthDate: "1980-01-02" },
  ]);

  assert.deepEqual(result.organizations, ["КМДА"]);
  assert.deepEqual(result.positions, ["Директор", "Радник"]);
  assert.deepEqual(result.cities, ["Київ", "Львів"]);
  assert.deepEqual(result.birthDates, ["1980-01-02"]);
});
