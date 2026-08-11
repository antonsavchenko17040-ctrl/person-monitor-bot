import test from "node:test";
import assert from "node:assert/strict";

import {
  orchestrateEdrSubjectMatch,
  resolveActiveEdrSubjectMatch,
} from "../src/edr-subject-resolution.js";

function hardRecord(id = "record-1") {
  return {
    candidateKind: "record",
    candidateId: id,
    recordId: id,
    snapshotId: "snapshot-1",
    recordType: "organization",
    relationType: null,
    score: 100,
    level: "confirmed",
    hardMatch: true,
    conflict: false,
    reasons: [
      "Точний збіг ЄДРПОУ",
    ],
  };
}

function probableFop(id = "fop-1") {
  return {
    candidateKind: "record",
    candidateId: id,
    recordId: id,
    snapshotId: "snapshot-1",
    recordType: "fop",
    relationType: null,
    score: 70,
    level: "probable",
    hardMatch: false,
    conflict: false,
    reasons: [
      "Точний збіг ПІБ ФОП",
    ],
  };
}

function conflictRecord(id = "conflict-1") {
  return {
    candidateKind: "record",
    candidateId: id,
    recordId: id,
    snapshotId: "snapshot-1",
    recordType: "organization",
    relationType: null,
    score: 0,
    level: "rejected",
    hardMatch: false,
    conflict: true,
    reasons: [
      "ЄДРПОУ суперечить ЄДРПОУ кандидата",
    ],
  };
}

test("requires candidate array", () => {
  assert.throws(
    () =>
      orchestrateEdrSubjectMatch({}),
    /searchResult.candidates must be an array/,
  );
});

test("single hard match is confirmed", () => {
  const hard = hardRecord();

  const result =
    orchestrateEdrSubjectMatch({
      status: "matched",
      decision: "exact_stable_identifier",
      best: hard,
      candidates: [hard],
    });

  assert.equal(result.status, "matched");
  assert.equal(
    result.decision,
    "exact_stable_identifier",
  );
  assert.equal(
    result.review_required,
    false,
  );
  assert.equal(
    result.hard_matches.length,
    1,
  );
  assert.equal(
    result.best.recordId,
    "record-1",
  );
});

test("multiple hard matches become conflict", () => {
  const first =
    hardRecord("record-1");

  const second =
    hardRecord("record-2");

  const result =
    orchestrateEdrSubjectMatch({
      status: "matched",
      decision: "exact_stable_identifier",
      best: first,
      candidates: [
        first,
        second,
      ],
    });

  assert.equal(
    result.status,
    "conflict",
  );
  assert.equal(
    result.decision,
    "manual_review",
  );
  assert.equal(
    result.review_required,
    true,
  );
  assert.equal(
    result.hard_matches.length,
    2,
  );
  assert.equal(result.best, null);
});

test("conflict without hard match requires review", () => {
  const conflict =
    conflictRecord();

  const result =
    orchestrateEdrSubjectMatch({
      status: "unmatched",
      decision: "no_match",
      best: conflict,
      candidates: [conflict],
    });

  assert.equal(
    result.status,
    "conflict",
  );
  assert.equal(
    result.decision,
    "manual_review",
  );
  assert.equal(
    result.review_required,
    true,
  );
  assert.equal(
    result.conflicts.length,
    1,
  );
});

test("hard match wins over conflicting name candidate", () => {
  const hard =
    hardRecord();

  const conflict =
    conflictRecord();

  const result =
    orchestrateEdrSubjectMatch({
      status: "matched",
      decision: "exact_stable_identifier",
      best: hard,
      candidates: [
        hard,
        conflict,
      ],
    });

  assert.equal(
    result.status,
    "matched",
  );
  assert.equal(
    result.review_required,
    false,
  );
  assert.equal(
    result.best.recordId,
    "record-1",
  );
  assert.equal(
    result.conflicts.length,
    1,
  );
});

test("name-only FOP remains ambiguous", () => {
  const candidate =
    probableFop();

  const result =
    orchestrateEdrSubjectMatch({
      status: "ambiguous",
      decision: "manual_review",
      best: candidate,
      candidates: [candidate],
    });

  assert.equal(
    result.status,
    "ambiguous",
  );
  assert.equal(
    result.decision,
    "manual_review",
  );
  assert.equal(
    result.review_required,
    true,
  );
  assert.equal(
    result.best.score,
    70,
  );
});

test("empty candidate result stays unmatched", () => {
  const result =
    orchestrateEdrSubjectMatch({
      status: "unmatched",
      decision: "no_match",
      best: null,
      candidates: [],
    });

  assert.equal(
    result.status,
    "unmatched",
  );
  assert.equal(
    result.decision,
    "no_match",
  );
  assert.equal(
    result.review_required,
    false,
  );
});

test("matched result without hard evidence is downgraded", () => {
  const candidate =
    probableFop();

  const result =
    orchestrateEdrSubjectMatch({
      status: "matched",
      decision: "unexpected_match",
      best: candidate,
      candidates: [candidate],
    });

  assert.equal(
    result.status,
    "ambiguous",
  );
  assert.equal(
    result.decision,
    "manual_review",
  );
  assert.equal(
    result.review_required,
    true,
  );
});

test("active resolver delegates retrieval and strips findCandidates option", async () => {
  const hard =
    hardRecord();

  const calls = [];

  const result =
    await resolveActiveEdrSubjectMatch(
      () => {},
      {
        name: "ТОВ ТЕСТ",
        edrpou: "12345678",
      },
      {
        recordLimit: 7,
        relationLimit: 9,
        findCandidates:
          async (
            sql,
            input,
            options,
          ) => {
            calls.push({
              sql,
              input,
              options,
            });

            return {
              status: "matched",
              decision:
                "exact_stable_identifier",
              best: hard,
              candidates: [hard],
              records: [],
              relations: [],
              retrieval: {
                record_count: 1,
              },
            };
          },
      },
    );

  assert.equal(
    calls.length,
    1,
  );

  assert.deepEqual(
    calls[0].options,
    {
      recordLimit: 7,
      relationLimit: 9,
    },
  );

  assert.equal(
    result.status,
    "matched",
  );

  assert.equal(
    result.retrieval.record_count,
    1,
  );
});
