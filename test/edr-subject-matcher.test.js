import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_SUBJECT_MATCH_LEVELS,
  rankEdrSubjectCandidates,
  scoreEdrRecordCandidate,
  scoreEdrRelationCandidate,
} from "../src/edr-subject-matcher.js";

function organization(
  overrides = {},
) {
  return {
    id: 1,
    snapshot_id: "snapshot-1",
    record_type: "organization",
    name: "ТОВ ТЕСТ",
    edrpou: "12345678",
    ...overrides,
  };
}

function fop(
  overrides = {},
) {
  return {
    id: 2,
    snapshot_id: "snapshot-1",
    record_type: "fop",
    name:
      "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    edrpou: null,
    ...overrides,
  };
}

function relation(
  overrides = {},
) {
  return {
    id: 3,
    snapshot_id: "snapshot-1",
    record_id: 1,
    record_type: "organization",
    relation_type: "founder",
    value_text:
      "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    normalized_value:
      "іваненко іван іванович",
    ...overrides,
  };
}

test(
  "organization EDRPOU is a hard confirmed match",
  () => {
    const result =
      scoreEdrRecordCandidate(
        {
          name: "Інша назва",
          edrpou: "12345678",
        },
        organization(),
      );

    assert.equal(
      result.score,
      100,
    );
    assert.equal(
      result.level,
      EDR_SUBJECT_MATCH_LEVELS.CONFIRMED,
    );
    assert.equal(
      result.hardMatch,
      true,
    );
    assert.equal(
      result.conflict,
      false,
    );
  },
);

test(
  "conflicting organization EDRPOU rejects candidate",
  () => {
    const result =
      scoreEdrRecordCandidate(
        {
          name: "ТОВ ТЕСТ",
          edrpou: "99999999",
        },
        organization(),
      );

    assert.equal(
      result.score,
      0,
    );
    assert.equal(
      result.level,
      EDR_SUBJECT_MATCH_LEVELS.REJECTED,
    );
    assert.equal(
      result.hardMatch,
      false,
    );
    assert.equal(
      result.conflict,
      true,
    );
  },
);

test(
  "exact FOP name is probable but never hard confirmed",
  () => {
    const result =
      scoreEdrRecordCandidate(
        {
          fullName:
            "  Іваненко   Іван Іванович ",
        },
        fop(),
      );

    assert.equal(
      result.score,
      70,
    );
    assert.equal(
      result.level,
      EDR_SUBJECT_MATCH_LEVELS.PROBABLE,
    );
    assert.equal(
      result.hardMatch,
      false,
    );
    assert.match(
      result.reasons.join(" "),
      /не підтверджує особу автоматично/,
    );
  },
);

test(
  "exact organization name without EDRPOU remains probable",
  () => {
    const result =
      scoreEdrRecordCandidate(
        {
          name: "ТОВ ТЕСТ",
        },
        organization({
          edrpou: null,
        }),
      );

    assert.equal(
      result.score,
      75,
    );
    assert.equal(
      result.level,
      EDR_SUBJECT_MATCH_LEVELS.PROBABLE,
    );
    assert.equal(
      result.hardMatch,
      false,
    );
  },
);

test(
  "partial FOP name produces only fuzzy evidence",
  () => {
    const result =
      scoreEdrRecordCandidate(
        {
          fullName:
            "ІВАНЕНКО ІВАН ПЕТРОВИЧ",
        },
        fop(),
      );

    assert.ok(
      result.score > 0,
    );
    assert.ok(
      result.score < 70,
    );
    assert.equal(
      result.hardMatch,
      false,
    );
  },
);

test(
  "exact relation name is probable and not a stable identifier",
  () => {
    const result =
      scoreEdrRelationCandidate(
        {
          fullName:
            "Іваненко Іван Іванович",
        },
        relation(),
      );

    assert.equal(
      result.score,
      70,
    );
    assert.equal(
      result.level,
      EDR_SUBJECT_MATCH_LEVELS.PROBABLE,
    );
    assert.equal(
      result.hardMatch,
      false,
    );
    assert.equal(
      result.relationType,
      "founder",
    );
  },
);

test(
  "hard EDRPOU match wins over name-only candidates",
  () => {
    const result =
      rankEdrSubjectCandidates(
        {
          name: "ТОВ ТЕСТ",
          edrpou: "12345678",
        },
        {
          records: [
            fop({
              id: 9,
              name: "ТОВ ТЕСТ",
            }),
            organization(),
          ],
        },
      );

    assert.equal(
      result.status,
      "matched",
    );
    assert.equal(
      result.decision,
      "exact_stable_identifier",
    );
    assert.equal(
      result.best.hardMatch,
      true,
    );
    assert.equal(
      result.best.recordId,
      1,
    );
  },
);

test(
  "name-only EDR evidence always requires manual review",
  () => {
    const result =
      rankEdrSubjectCandidates(
        {
          fullName:
            "Іваненко Іван Іванович",
        },
        {
          records: [
            fop(),
          ],
          relations: [
            relation(),
          ],
        },
      );

    assert.equal(
      result.status,
      "ambiguous",
    );
    assert.equal(
      result.decision,
      "manual_review",
    );
    assert.equal(
      result.best.hardMatch,
      false,
    );
    assert.equal(
      result.best.score,
      70,
    );
  },
);

test(
  "low-scoring evidence stays unmatched",
  () => {
    const result =
      rankEdrSubjectCandidates(
        {
          fullName:
            "ПЕТРЕНКО ПЕТРО ПЕТРОВИЧ",
        },
        {
          records: [
            fop(),
          ],
          relations: [
            relation(),
          ],
        },
      );

    assert.equal(
      result.status,
      "unmatched",
    );
    assert.equal(
      result.decision,
      "no_match",
    );
  },
);

test(
  "validates input and candidate types before matching",
  () => {
    assert.throws(
      () =>
        rankEdrSubjectCandidates(
          {},
        ),
      /fullName\/name or edrpou is required/,
    );

    assert.throws(
      () =>
        scoreEdrRecordCandidate(
          { name: "test" },
          {
            record_type: "person",
            name: "test",
          },
        ),
      /Unsupported EDR record type/,
    );

    assert.throws(
      () =>
        scoreEdrRelationCandidate(
          { fullName: "test" },
          {
            relation_type:
              "unknown",
            value_text: "test",
          },
        ),
      /Unsupported EDR relation type/,
    );
  },
);
