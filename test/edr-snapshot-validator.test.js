import test from "node:test";
import assert from "node:assert/strict";

import {
  setEdrSnapshotResourceImportedCount,
  loadEdrSnapshotValidationStats,
  validateEdrSnapshotCounts,
} from "../src/edr-snapshot-validator.js";

function queryText(
  strings,
) {
  return strings
    .join("?")
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function validStats(
  overrides = {},
) {
  return {
    id:
      "snapshot-1",

    status:
      "staging",

    resource_count:
      2,

    organization_resource_count:
      3,

    fop_resource_count:
      2,

    organization_count:
      3,

    fop_count:
      2,

    relation_count:
      7,

    min_source_sequence:
      0,

    max_source_sequence:
      4,

    cross_snapshot_relation_count:
      0,

    ...overrides,
  };
}

test(
  "sets imported resource count only for staging snapshot",
  async () => {
    const sql =
      async (
        strings,
        ...values
      ) => {
        const text =
          queryText(
            strings,
          );

        assert.match(
          text,
          /UPDATE edr_snapshot_resources/,
        );

        assert.match(
          text,
          /s\.status = 'staging'/,
        );

        assert.deepEqual(
          values,
          [
            15,
            "snapshot-1",
            "organization",
          ],
        );

        return [
          {
            snapshot_id:
              "snapshot-1",

            resource_type:
              "organization",

            imported_count:
              15,
          },
        ];
      };

    const result =
      await setEdrSnapshotResourceImportedCount(
        sql,
        {
          snapshotId:
            "snapshot-1",

          resourceType:
            "organization",

          importedCount:
            15,
        },
      );

    assert.equal(
      result.imported_count,
      15,
    );
  },
);

test(
  "rejects invalid resource count input before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      setEdrSnapshotResourceImportedCount(
        sql,
        {
          snapshotId:
            "snapshot-1",

          resourceType:
            "unknown",

          importedCount:
            1,
        },
      ),
      /Unsupported EDR resource type/,
    );

    await assert.rejects(
      setEdrSnapshotResourceImportedCount(
        sql,
        {
          snapshotId:
            "snapshot-1",

          resourceType:
            "fop",

          importedCount:
            -1,
        },
      ),
      /importedCount/,
    );

    assert.equal(
      calls,
      0,
    );
  },
);

test(
  "loads normalized EDR snapshot validation stats",
  async () => {
    const result =
      await loadEdrSnapshotValidationStats(
        async (
          strings,
        ) => {
          const text =
            queryText(
              strings,
            );

          assert.match(
            text,
            /cross_snapshot_relation_count/,
          );

          return [
            validStats({
              resource_count:
                "2",

              organization_count:
                "3",

              fop_count:
                "2",

              relation_count:
                "7",
            }),
          ];
        },
        {
          snapshotId:
            "snapshot-1",
        },
      );

    assert.deepEqual(
      result,
      {
        snapshot_id:
          "snapshot-1",

        status:
          "staging",

        resource_count:
          2,

        organization_resource_count:
          3,

        fop_resource_count:
          2,

        organization_count:
          3,

        fop_count:
          2,

        relation_count:
          7,

        min_source_sequence:
          0,

        max_source_sequence:
          4,

        cross_snapshot_relation_count:
          0,
      },
    );
  },
);

test(
  "returns null validation stats for missing snapshot",
  async () => {
    const result =
      await loadEdrSnapshotValidationStats(
        async () => [],
        {
          snapshotId:
            "snapshot-missing",
        },
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  "validates exact resource record relation and sequence counts",
  async () => {
    const result =
      await validateEdrSnapshotCounts(
        async () => [
          validStats(),
        ],
        {
          snapshotId:
            "snapshot-1",

          organizationCount:
            3,

          fopCount:
            2,

          relationCount:
            7,
        },
      );

    assert.equal(
      result.ok,
      true,
    );

    assert.equal(
      result.total_records,
      5,
    );
  },
);

test(
  "rejects count mismatches",
  async () => {
    await assert.rejects(
      validateEdrSnapshotCounts(
        async () => [
          validStats({
            organization_count:
              2,
          }),
        ],
        {
          snapshotId:
            "snapshot-1",

          organizationCount:
            3,

          fopCount:
            2,

          relationCount:
            7,
        },
      ),
      /organization record count mismatch/,
    );

    await assert.rejects(
      validateEdrSnapshotCounts(
        async () => [
          validStats({
            fop_resource_count:
              1,
          }),
        ],
        {
          snapshotId:
            "snapshot-1",

          organizationCount:
            3,

          fopCount:
            2,

          relationCount:
            7,
        },
      ),
      /FOP resource count mismatch/,
    );
  },
);

test(
  "rejects incomplete resources sequence gaps and cross snapshot relations",
  async () => {
    const options = {
      snapshotId:
        "snapshot-1",

      organizationCount:
        3,

      fopCount:
        2,

      relationCount:
        7,
    };

    await assert.rejects(
      validateEdrSnapshotCounts(
        async () => [
          validStats({
            resource_count:
              1,
          }),
        ],
        options,
      ),
      /exactly two resources/,
    );

    await assert.rejects(
      validateEdrSnapshotCounts(
        async () => [
          validStats({
            max_source_sequence:
              5,
          }),
        ],
        options,
      ),
      /source sequence is not contiguous/,
    );

    await assert.rejects(
      validateEdrSnapshotCounts(
        async () => [
          validStats({
            cross_snapshot_relation_count:
              1,
          }),
        ],
        options,
      ),
      /cross-snapshot relations/,
    );
  },
);
