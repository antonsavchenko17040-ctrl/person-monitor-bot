import test from "node:test";
import assert from "node:assert/strict";

import {
  failEdrSnapshotIfStaging,
  runEdrSnapshotWithFailureGuard,
} from "../src/edr-snapshot-failure.js";

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
  "marks only staging snapshot as failed",
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
          /UPDATE edr_snapshots/,
        );

        assert.match(
          text,
          /status = 'failed'/,
        );

        assert.match(
          text,
          /AND status = 'staging'/,
        );

        assert.doesNotMatch(
          text,
          /edr_active_snapshot/,
        );

        assert.deepEqual(
          values,
          [
            "boom",
            "snapshot-1",
          ],
        );

        return [
          {
            id:
              "snapshot-1",
            status:
              "failed",
            error_text:
              "boom",
          },
        ];
      };

    const row =
      await failEdrSnapshotIfStaging(
        sql,
        {
          snapshotId:
            "snapshot-1",
          error:
            new Error(
              "boom",
            ),
        },
      );

    assert.equal(
      row.status,
      "failed",
    );
  },
);

test(
  "returns null when snapshot is no longer staging",
  async () => {
    const row =
      await failEdrSnapshotIfStaging(
        async () => [],
        {
          snapshotId:
            "snapshot-1",
          error:
            "activation failed",
        },
      );

    assert.equal(
      row,
      null,
    );
  },
);

test(
  "returns successful work result without marking failure",
  async () => {
    let failureCalls = 0;

    const result =
      await runEdrSnapshotWithFailureGuard(
        null,
        {
          snapshotId:
            "snapshot-1",

          work:
            async (
              sql,
              options,
            ) => {
              assert.equal(
                sql,
                null,
              );

              assert.deepEqual(
                options,
                {
                  snapshotId:
                    "snapshot-1",
                },
              );

              return {
                ok: true,
              };
            },

          failSnapshot:
            async () => {
              failureCalls += 1;
            },
        },
      );

    assert.deepEqual(
      result,
      {
        ok: true,
      },
    );

    assert.equal(
      failureCalls,
      0,
    );
  },
);

test(
  "marks staging snapshot failed and rethrows original error",
  async () => {
    const original =
      new Error(
        "validation failed",
      );

    const failures = [];

    await assert.rejects(
      runEdrSnapshotWithFailureGuard(
        null,
        {
          snapshotId:
            "snapshot-1",

          work:
            async () => {
              throw original;
            },

          failSnapshot:
            async (
              sql,
              options,
            ) => {
              failures.push({
                sql,
                ...options,
              });

              return {
                status:
                  "failed",
              };
            },
        },
      ),
      (error) =>
        error === original,
    );

    assert.equal(
      failures.length,
      1,
    );

    assert.equal(
      failures[0].snapshotId,
      "snapshot-1",
    );

    assert.equal(
      failures[0].error,
      original,
    );
  },
);

test(
  "preserves original failure when snapshot is already ready",
  async () => {
    const original =
      new Error(
        "activation failed",
      );

    let failureCalls = 0;

    await assert.rejects(
      runEdrSnapshotWithFailureGuard(
        null,
        {
          snapshotId:
            "snapshot-1",

          work:
            async () => {
              throw original;
            },

          failSnapshot:
            async () => {
              failureCalls += 1;
              return null;
            },
        },
      ),
      (error) =>
        error === original,
    );

    assert.equal(
      failureCalls,
      1,
    );
  },
);

test(
  "surfaces work and failure-state errors together",
  async () => {
    const workError =
      new Error(
        "import failed",
      );

    const markError =
      new Error(
        "database unavailable",
      );

    await assert.rejects(
      runEdrSnapshotWithFailureGuard(
        null,
        {
          snapshotId:
            "snapshot-1",

          work:
            async () => {
              throw workError;
            },

          failSnapshot:
            async () => {
              throw markError;
            },
        },
      ),
      (error) => {
        assert.ok(
          error instanceof
            AggregateError,
        );

        assert.equal(
          error.cause,
          workError,
        );

        assert.deepEqual(
          error.errors,
          [
            workError,
            markError,
          ],
        );

        return true;
      },
    );
  },
);
