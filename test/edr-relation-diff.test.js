import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_RELATION_DIFF_VERSION,
  edrRelationObservationKey,
  compareEdrRelationObservations,
} from "../src/edr-relation-diff.js";

function relation({
  id = 1,
  snapshotId = "old",
  type = "founder",
  ordinal = 0,
  value = "ІВАНЕНКО ІВАН ІВАНОВИЧ",
  normalizedValue =
    "іваненко іван іванович",
  code = null,
  edrpou = "12345678",
  recordType = "organization",
} = {}) {
  return {
    id,
    snapshot_id:
      snapshotId,
    record_id: 100,
    relation_type:
      type,
    ordinal,
    value_text:
      value,
    normalized_value:
      normalizedValue,
    value_code:
      code,
    record_type:
      recordType,
    record_name:
      "ТОВ ТЕСТ",
    record_edrpou:
      edrpou,
  };
}

test("exports relation diff version", () => {
  assert.equal(
    EDR_RELATION_DIFF_VERSION,
    "edr-relation-diff-v1",
  );
});

test("builds relation identity without ordinal", () => {
  const first =
    edrRelationObservationKey(
      relation({
        ordinal: 0,
      }),
    );

  const second =
    edrRelationObservationKey(
      relation({
        ordinal: 8,
      }),
    );

  assert.equal(
    first,
    second,
  );

  assert.equal(
    first,
    "organization:edrpou:12345678|founder|text:іваненко іван іванович",
  );
});

test("ordinal reorder is unchanged", () => {
  const result =
    compareEdrRelationObservations(
      [
        relation({
          ordinal: 0,
        }),
      ],
      [
        relation({
          snapshotId:
            "new",
          ordinal: 4,
        }),
      ],
    );

  assert.equal(
    result.summary.unchanged,
    1,
  );

  assert.equal(
    result.summary.added,
    0,
  );

  assert.equal(
    result.summary.removed,
    0,
  );
});

test("detects added and removed relation observations", () => {
  const result =
    compareEdrRelationObservations(
      [
        relation({
          normalizedValue:
            "стара особа",
          value:
            "СТАРА ОСОБА",
        }),
      ],
      [
        relation({
          snapshotId:
            "new",
          normalizedValue:
            "нова особа",
          value:
            "НОВА ОСОБА",
        }),
      ],
    );

  assert.equal(
    result.summary.added,
    1,
  );

  assert.equal(
    result.summary.removed,
    1,
  );
});

test("preserves duplicate multiplicity", () => {
  const oldRows = [
    relation({
      id: 1,
    }),
    relation({
      id: 2,
      ordinal: 1,
    }),
  ];

  const newRows = [
    relation({
      id: 3,
      snapshotId:
        "new",
    }),
  ];

  const result =
    compareEdrRelationObservations(
      oldRows,
      newRows,
    );

  assert.equal(
    result.summary.unchanged,
    1,
  );

  assert.equal(
    result.summary.removed,
    1,
  );
});

test("stable value code wins over display text", () => {
  const oldRow =
    relation({
      type:
        "executive_power",
      value:
        "СТАРА НАЗВА",
      normalizedValue:
        "стара назва",
      code:
        "ABC-10",
    });

  const newRow =
    relation({
      snapshotId:
        "new",
      type:
        "executive_power",
      value:
        "НОВА НАЗВА",
      normalizedValue:
        "нова назва",
      code:
        "abc-10",
    });

  const result =
    compareEdrRelationObservations(
      [oldRow],
      [newRow],
    );

  assert.equal(
    result.summary.unchanged,
    1,
  );
});

test("unsupported relation types are not treated as subject changes", () => {
  const result =
    compareEdrRelationObservations(
      [
        relation({
          type:
            "branch",
        }),
      ],
      [],
    );

  assert.equal(
    result.summary.removed,
    0,
  );

  assert.equal(
    result.summary
      .unsupported_old,
    1,
  );
});

test("relation without stable parent EDRPOU remains unkeyed", () => {
  const result =
    compareEdrRelationObservations(
      [
        relation({
          edrpou:
            null,
        }),
      ],
      [],
    );

  assert.equal(
    result.summary.removed,
    0,
  );

  assert.equal(
    result.summary.unkeyed_old,
    1,
  );
});
