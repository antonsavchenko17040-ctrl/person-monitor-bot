import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_SNAPSHOT_DIFF_VERSION,
  organizationSnapshotKey,
  compareEdrOrganizationRecords,
  compareEdrFopObservations,
  compareEdrSnapshotRecords,
} from "../src/edr-snapshot-diff.js";

function organization({
  edrpou,
  hash,
  name = "ТОВ ТЕСТ",
  recordNumber = "1",
} = {}) {
  return {
    record_type:
      "organization",
    record_number:
      recordNumber,
    name,
    edrpou,
    content_hash:
      hash,
  };
}

function fop({
  hash,
  name =
    "ІВАНЕНКО ІВАН ІВАНОВИЧ",
  recordNumber = "1",
} = {}) {
  return {
    record_type:
      "fop",
    record_number:
      recordNumber,
    name,
    edrpou: null,
    content_hash:
      hash,
  };
}

test("exports snapshot diff version", () => {
  assert.equal(
    EDR_SNAPSHOT_DIFF_VERSION,
    "edr-snapshot-diff-v1",
  );
});

test("organization identity uses EDRPOU and never RECORD", () => {
  assert.equal(
    organizationSnapshotKey(
      organization({
        edrpou:
          "12 34 56 78",
        hash: "a",
        recordNumber:
          "unstable-record",
      }),
    ),
    "organization:edrpou:12345678",
  );

  assert.equal(
    organizationSnapshotKey(
      organization({
        edrpou: null,
        hash: "a",
        recordNumber:
          "12345678",
      }),
    ),
    null,
  );
});

test("same organization hash is unchanged", () => {
  const result =
    compareEdrOrganizationRecords(
      [
        organization({
          edrpou:
            "12345678",
          hash: "same",
        }),
      ],
      [
        organization({
          edrpou:
            "12345678",
          hash: "same",
        }),
      ],
    );

  assert.equal(
    result.summary.unchanged,
    1,
  );

  assert.equal(
    result.summary.changed,
    0,
  );
});

test("same EDRPOU with new hash is changed", () => {
  const result =
    compareEdrOrganizationRecords(
      [
        organization({
          edrpou:
            "12345678",
          hash: "old",
        }),
      ],
      [
        organization({
          edrpou:
            "12345678",
          hash: "new",
        }),
      ],
    );

  assert.equal(
    result.summary.changed,
    1,
  );

  assert.equal(
    result.changed[0].key,
    "organization:edrpou:12345678",
  );
});

test("organizations can be added and removed", () => {
  const result =
    compareEdrOrganizationRecords(
      [
        organization({
          edrpou:
            "11111111",
          hash: "old",
        }),
      ],
      [
        organization({
          edrpou:
            "22222222",
          hash: "new",
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

test("duplicate EDRPOU is ambiguous instead of auto-compared", () => {
  const result =
    compareEdrOrganizationRecords(
      [
        organization({
          edrpou:
            "12345678",
          hash: "old-1",
        }),
        organization({
          edrpou:
            "12345678",
          hash: "old-2",
        }),
      ],
      [
        organization({
          edrpou:
            "12345678",
          hash: "new",
        }),
      ],
    );

  assert.equal(
    result.summary.ambiguous,
    1,
  );

  assert.equal(
    result.summary.changed,
    0,
  );
});

test("FOP with same name but different hash is not classified as changed identity", () => {
  const result =
    compareEdrFopObservations(
      [
        fop({
          hash: "old",
          recordNumber: "10",
        }),
      ],
      [
        fop({
          hash: "new",
          recordNumber: "20",
        }),
      ],
    );

  assert.equal(
    result.summary.changed,
    0,
  );

  assert.equal(
    result.summary
      .added_observations,
    1,
  );

  assert.equal(
    result.summary
      .removed_observations,
    1,
  );
});

test("identical FOP content hash remains unchanged observation", () => {
  const result =
    compareEdrFopObservations(
      [
        fop({
          hash: "same",
          recordNumber: "10",
        }),
      ],
      [
        fop({
          hash: "same",
          recordNumber: "999",
        }),
      ],
    );

  assert.equal(
    result.unchanged_count,
    1,
  );

  assert.equal(
    result.summary
      .added_observations,
    0,
  );

  assert.equal(
    result.summary
      .removed_observations,
    0,
  );
});

test("builds combined conservative snapshot diff", () => {
  const result =
    compareEdrSnapshotRecords({
      oldRecords: [
        organization({
          edrpou:
            "12345678",
          hash: "old",
        }),
        fop({
          hash:
            "old-fop",
        }),
      ],

      newRecords: [
        organization({
          edrpou:
            "12345678",
          hash: "new",
        }),
        fop({
          hash:
            "new-fop",
        }),
      ],
    });

  assert.equal(
    result.version,
    "edr-snapshot-diff-v1",
  );

  assert.equal(
    result.summary
      .organization_changes,
    1,
  );

  assert.equal(
    result.summary
      .fop_added_observations,
    1,
  );

  assert.equal(
    result.summary
      .fop_removed_observations,
    1,
  );
});
