import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_SNAPSHOT_STATUSES,
  createEdrSnapshot,
  registerEdrSnapshotResource,
  markEdrSnapshotReady,
  markEdrSnapshotFailed,
  activateEdrSnapshot,
  getActiveEdrSnapshot,
} from "../src/edr-snapshot-store.js";

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

test(
  "exports EDR snapshot statuses",
  () => {
    assert.deepEqual(
      EDR_SNAPSHOT_STATUSES,
      {
        STAGING:
          "staging",

        READY:
          "ready",

        FAILED:
          "failed",
      },
    );
  },
);

test(
  "creates staging EDR snapshot",
  async () => {
    const calls = [];

    const sql =
      async (
        strings,
        ...values
      ) => {
        calls.push({
          text:
            queryText(
              strings,
            ),
          values,
        });

        return [
          {
            id:
              "snapshot-1",
            version_key:
              "version-1",
            status:
              "staging",
          },
        ];
      };

    const result =
      await createEdrSnapshot(
        sql,
        {
          versionKey:
            "version-1",

          schemaVersion:
            "edr-normalized-v1",
        },
      );

    assert.equal(
      result.created,
      true,
    );

    assert.equal(
      result.snapshot.status,
      "staging",
    );

    assert.match(
      calls[0].text,
      /INSERT INTO edr_snapshots/,
    );
  },
);

test(
  "reuses existing snapshot version",
  async () => {
    let call = 0;

    const sql =
      async () => {
        call += 1;

        if (call === 1) {
          return [];
        }

        return [
          {
            id:
              "snapshot-existing",
            version_key:
              "version-1",
            status:
              "ready",
          },
        ];
      };

    const result =
      await createEdrSnapshot(
        sql,
        {
          versionKey:
            "version-1",

          schemaVersion:
            "edr-normalized-v1",
        },
      );

    assert.equal(
      result.created,
      false,
    );

    assert.equal(
      result.snapshot.id,
      "snapshot-existing",
    );
  },
);

test(
  "registers resource only for staging snapshot",
  async () => {
    const sql =
      async (
        strings,
      ) => {
        assert.match(
          queryText(
            strings,
          ),
          /s\.status = 'staging'/,
        );

        return [
          {
            id:
              "resource-1",
            resource_type:
              "organization",
          },
        ];
      };

    const result =
      await registerEdrSnapshotResource(
        sql,
        {
          snapshotId:
            "snapshot-1",

          resourceType:
            "organization",

          resourceName:
            "UO.zip",

          resourceId:
            "resource-id",

          sourceUrl:
            "https://example.test/UO.zip",

          expectedSize:
            100,

          downloadedSize:
            100,

          sha256:
            "abc",
        },
      );

    assert.equal(
      result.resource_type,
      "organization",
    );
  },
);

test(
  "transitions staging snapshot to ready",
  async () => {
    const sql =
      async (
        strings,
      ) => {
        assert.match(
          queryText(
            strings,
          ),
          /AND status = 'staging'/,
        );

        return [
          {
            id:
              "snapshot-1",
            status:
              "ready",
          },
        ];
      };

    const result =
      await markEdrSnapshotReady(
        sql,
        {
          snapshotId:
            "snapshot-1",

          organizationCount:
            10,

          fopCount:
            20,

          relationCount:
            30,
        },
      );

    assert.equal(
      result.status,
      "ready",
    );
  },
);

test(
  "transitions staging snapshot to failed",
  async () => {
    const sql =
      async () => [
        {
          id:
            "snapshot-1",
          status:
            "failed",
          error_text:
            "broken archive",
        },
      ];

    const result =
      await markEdrSnapshotFailed(
        sql,
        {
          snapshotId:
            "snapshot-1",

          error:
            new Error(
              "broken archive",
            ),
        },
      );

    assert.equal(
      result.status,
      "failed",
    );

    assert.equal(
      result.error_text,
      "broken archive",
    );
  },
);

test(
  "activates only ready snapshot using single upsert",
  async () => {
    const sql =
      async (
        strings,
      ) => {
        const text =
          queryText(
            strings,
          );

        assert.match(
          text,
          /status = 'ready'/,
        );

        assert.match(
          text,
          /ON CONFLICT \( singleton \)/,
        );

        return [
          {
            snapshot_id:
              "snapshot-1",
            activated_at:
              "2026-08-10T00:00:00Z",
          },
        ];
      };

    const result =
      await activateEdrSnapshot(
        sql,
        {
          snapshotId:
            "snapshot-1",
        },
      );

    assert.equal(
      result.snapshot_id,
      "snapshot-1",
    );
  },
);

test(
  "rejects activation when snapshot is not ready",
  async () => {
    const sql =
      async () => [];

    await assert.rejects(
      activateEdrSnapshot(
        sql,
        {
          snapshotId:
            "snapshot-1",
        },
      ),
      /not ready for activation/,
    );
  },
);

test(
  "returns active EDR snapshot or null",
  async () => {
    const active =
      await getActiveEdrSnapshot(
        async () => [
          {
            id:
              "snapshot-1",
            status:
              "ready",
          },
        ],
      );

    assert.equal(
      active.id,
      "snapshot-1",
    );

    const missing =
      await getActiveEdrSnapshot(
        async () => [],
      );

    assert.equal(
      missing,
      null,
    );
  },
);
