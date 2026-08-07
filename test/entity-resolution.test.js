import test from "node:test";
import assert from "node:assert/strict";

import {
  resolvePersonFromCandidates,
  scorePersonCandidate,
  textSimilarity,
} from "../src/entity-resolution.js";

const candidate = {
  id: "11111111-1111-1111-1111-111111111111",
  canonical_name: "Савченко Антон Віталійович",

  identifiers: [
    {
      type: "full_name",
      value: "Савченко Антон Віталійович",
    },
    {
      type: "alias",
      value: "Антон Савченко",
    },
    {
      type: "guid",
      value: "ABC-123",
    },
  ],

  facts: [
    {
      type: "position",
      value: "Головний спеціаліст",
    },
    {
      type: "organization",
      value: "Національне агентство",
    },
    {
      type: "city",
      value: "Київ",
    },
  ],
};

test("textSimilarity detects identical token sets", () => {
  assert.equal(
    textSimilarity(
      "головний спеціаліст",
      "Головний спеціаліст",
    ),
    1,
  );
});

test("exact GUID produces confirmed 100", () => {
  const result = scorePersonCandidate(
    {
      guid: "abc-123",
      fullName: "Інше ім'я",
    },
    candidate,
  );

  assert.equal(result.score, 100);
  assert.equal(result.level, "confirmed");
  assert.equal(result.hardMatch, true);
});

test("conflicting GUID rejects candidate", () => {
  const result = scorePersonCandidate(
    {
      guid: "different-guid",
      fullName: "Савченко Антон Віталійович",
    },
    candidate,
  );

  assert.equal(result.score, 0);
  assert.equal(result.level, "rejected");
});

test("exact full name alone is probable", () => {
  const result = scorePersonCandidate(
    {
      fullName: "Савченко Антон Віталійович",
    },
    candidate,
  );

  assert.equal(result.score, 70);
  assert.equal(result.level, "probable");
});

test("full name plus position confirms identity", () => {
  const result = scorePersonCandidate(
    {
      fullName: "Савченко Антон Віталійович",
      position: "Головний спеціаліст",
    },
    candidate,
  );

  assert.equal(result.score, 85);
  assert.equal(result.level, "confirmed");
});

test("different ordering of full name still matches", () => {
  const result = scorePersonCandidate(
    {
      fullName: "Антон Віталійович Савченко",
    },
    candidate,
  );

  assert.equal(result.score, 70);
});

test("resolver returns highest scoring candidate", () => {
  const other = {
    id: "22222222-2222-2222-2222-222222222222",
    canonical_name: "Іваненко Іван Іванович",
    identifiers: [],
    facts: [],
  };

  const result = resolvePersonFromCandidates(
    {
      fullName: "Савченко Антон Віталійович",
      position: "Головний спеціаліст",
    },
    [other, candidate],
  );

  assert.equal(result.best.entityId, candidate.id);
  assert.equal(result.best.level, "confirmed");
});
