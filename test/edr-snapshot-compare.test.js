import test from "node:test";
import assert from "node:assert/strict";

import {
  getEdrSnapshotDescriptor,
  loadEdrSnapshotRecords,
  compareEdrSnapshots,
} from "../src/edr-snapshot-compare.js";

function fakeSql({
  snapshots = {},
  records = {},
} = {}) {
  const calls = [];

  const sql =
    async (
      strings,
      ...values
    ) => {
      const text =
        strings
          .join("?")
          .replace(
            /\s+/g,
            " ",
          )
          .trim();

      calls.push({
        text,
        values,
      });

      if (
        text.includes(
          "FROM edr_snapshots",
        )
      ) {
        const row =
          snapshots[
            values[0]
          ];

        return row
          ? [row]
          : [];
      }

      if (
        text.includes(
          "FROM edr_records",
        )
      ) {
        return (
          records[
            values[0]
          ] ?? []
        );
      }

      throw new Error(
        "Unexpected SQL: " +
        text,
      );
    };

  sql.calls =
    calls;

  return sql;
}

function snapshot(
  id,
  status = "ready",
) {
  return {
    id,
    version_key:
      "version-" + id,
    schema_version:
      "edr-normalized-v1",
    status,
    discovered_at:
      null,
    completed_at:
      null,
    organization_count:
      0,
    fop_count:
      0,
    relation_count:
      0,
  };
}

function organization({
  snapshotId,
  edrpou,
  hash,
  sequence = 0,
} = {}) {
  return {
    id:
      sequence + 1,
    snapshot_id:
      snapshotId,
    record_type:
      "organization",
    record_number:
      "record-" +
      sequence,
    source_sequence:
      sequence,
    name:
      "ТОВ ТЕСТ",
    edrpou,
    content_hash:
      hash,
  };
}

function fop({
  snapshotId,
  hash,
  sequence = 0,
} = {}) {
  return {
    id:
      sequence + 1,
    snapshot_id:
      snapshotId,
    record_type:
      "fop",
    record_number:
      "fop-" +
      sequence,
    source_sequence:
      sequence,
    name:
      "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    edrpou:
      null,
    content_hash:
      hash,
  };
}

test(
  "loads snapshot descriptor by id",
  async () => {
    const sql =
      fakeSql({
        snapshots: {
          old:
            snapshot("old"),
        },
      });

    const result =
      await getEdrSnapshotDescriptor(
        sql,
        "old",
      );

    assert.equal(
      result.id,
      "old",
    );

    assert.equal(
      result.status,
      "ready",
    );
  },
);

test(
  "missing snapshot descriptor returns null",
  async () => {
    const sql =
      fakeSql();

    const result =
      await getEdrSnapshotDescriptor(
        sql,
        "missing",
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  "loads records for one snapshot in deterministic order query",
  async () => {
    const expected = [
      organization({
        snapshotId: "old",
        edrpou:
          "12345678",
        hash: "a",
      }),
    ];

    const sql =
      fakeSql({
        records: {
          old:
            expected,
        },
      });

    const result =
      await loadEdrSnapshotRecords(
        sql,
        "old",
      );

    assert.deepEqual(
      result,
      expected,
    );

    assert.ok(
      sql.calls[0].text.includes(
        "ORDER BY source_sequence ASC, id ASC",
      ),
    );
  },
);

test(
  "rejects comparison of the same snapshot",
  async () => {
    const sql =
      fakeSql();

    await assert.rejects(
      () =>
        compareEdrSnapshots(
          sql,
          {
            oldSnapshotId:
              "same",
            newSnapshotId:
              "same",
          },
        ),
      /snapshot ids must be different/,
    );

    assert.equal(
      sql.calls.length,
      0,
    );
  },
);

test(
  "requires old snapshot to exist",
  async () => {
    const sql =
      fakeSql();

    await assert.rejects(
      () =>
        compareEdrSnapshots(
          sql,
          {
            oldSnapshotId:
              "old",
            newSnapshotId:
              "new",
          },
        ),
      /old snapshot not found/,
    );
  },
);

test(
  "requires both snapshots to be ready",
  async () => {
    const sql =
      fakeSql({
        snapshots: {
          old:
            snapshot(
              "old",
            ),
          new:
            snapshot(
              "new",
              "staging",
            ),
        },
      });

    await assert.rejects(
      () =>
        compareEdrSnapshots(
          sql,
          {
            oldSnapshotId:
              "old",
            newSnapshotId:
              "new",
          },
        ),
      /new snapshot must be ready/,
    );
  },
);

test(
  "compares two database snapshots conservatively",
  async () => {
    const sql =
      fakeSql({
        snapshots: {
          old:
            snapshot("old"),
          new:
            snapshot("new"),
        },

        records: {
          old: [
            organization({
              snapshotId:
                "old",
              edrpou:
                "12345678",
              hash:
                "org-old",
              sequence: 0,
            }),

            fop({
              snapshotId:
                "old",
              hash:
                "fop-old",
              sequence: 1,
            }),
          ],

          new: [
            organization({
              snapshotId:
                "new",
              edrpou:
                "12345678",
              hash:
                "org-new",
              sequence: 0,
            }),

            fop({
              snapshotId:
                "new",
              hash:
                "fop-new",
              sequence: 1,
            }),
          ],
        },
      });

    const result =
      await compareEdrSnapshots(
        sql,
        {
          oldSnapshotId:
            "old",
          newSnapshotId:
            "new",
        },
      );

    assert.equal(
      result.old_snapshot.id,
      "old",
    );

    assert.equal(
      result.new_snapshot.id,
      "new",
    );

    assert.equal(
      result.old_record_count,
      2,
    );

    assert.equal(
      result.new_record_count,
      2,
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
  },
);
