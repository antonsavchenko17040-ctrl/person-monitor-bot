import test from "node:test";
import assert from "node:assert/strict";

import {
  decisionFromFuzzy,
  isHardIdentifierType,
  normalizeIdentifierValue,
} from "../src/identity-observations.js";

test("GUID normalization is stable", () => {
  assert.equal(
    normalizeIdentifierValue(
      "nazk_guid",
      "{ABC-123-DEF}",
    ),
    "abc-123-def",
  );
});

test("subject_id is a hard identifier", () => {
  assert.equal(
    isHardIdentifierType("subject_id"),
    true,
  );
});

test("full_name is not a hard identifier", () => {
  assert.equal(
    isHardIdentifierType("full_name"),
    false,
  );
});

test("confirmed 85+ can auto-match", () => {
  assert.deepEqual(
    decisionFromFuzzy({
      score: 85,
      level: "confirmed",
    }),
    {
      status: "matched",
      decision: "existing_entity",
    },
  );
});

test("probable match requires review", () => {
  assert.deepEqual(
    decisionFromFuzzy({
      score: 70,
      level: "probable",
    }),
    {
      status: "ambiguous",
      decision: "manual_review",
    },
  );
});

test("weak match becomes new entity candidate", () => {
  assert.deepEqual(
    decisionFromFuzzy({
      score: 40,
      level: "rejected",
    }),
    {
      status: "unmatched",
      decision: "new_entity_candidate",
    },
  );
});
