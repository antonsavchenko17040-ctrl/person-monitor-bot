import test from "node:test";
import assert from "node:assert/strict";

import {
  finalizeEdrSnapshot,
} from "../src/edr-snapshot-finalizer.js";

function validationResult() {
  return {
    ok: true,
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
    total_records:
      5,
  };
}

test(
  "finalizes snapshot in validate ready activate order",
  async () => {
    const calls = [];
    const sql = () => {};

    const result =
      await finalizeEdrSnapshot(
        sql,
        {
          snapshotId:
            "snapshot-1",
          organizationCount:
            3,
          fopCount:
            2,
          relationCount:
            7,

          validateSnapshot:
            async (
              receivedSql,
              options,
            ) => {
              calls.push([
                "validate",
                receivedSql,
                options,
              ]);

              return validationResult();
            },

          markReady:
            async (
              receivedSql,
              options,
            ) => {
              calls.push([
                "ready",
                receivedSql,
                options,
              ]);

              return {
                id:
                  "snapshot-1",
                status:
                  "ready",
              };
            },

          activateSnapshot:
            async (
              receivedSql,
              options,
            ) => {
              calls.push([
                "activate",
                receivedSql,
                options,
              ]);

              return {
                snapshot_id:
                  "snapshot-1",
              };
            },
        },
      );

    assert.deepEqual(
      calls.map(
        ([name]) => name,
      ),
      [
        "validate",
        "ready",
        "activate",
      ],
    );

    assert.equal(
      calls[0][1],
      sql,
    );

    assert.deepEqual(
      calls[1][2],
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

    assert.deepEqual(
      result.activation,
      {
        snapshot_id:
          "snapshot-1",
      },
    );
  },
);

test(
  "does not mark ready or activate when validation fails",
  async () => {
    let readyCalls = 0;
    let activationCalls = 0;

    await assert.rejects(
      finalizeEdrSnapshot(
        null,
        {
          snapshotId:
            "snapshot-1",
          organizationCount:
            3,
          fopCount:
            2,
          relationCount:
            7,

          validateSnapshot:
            async () => {
              throw new Error(
                "validation failed",
              );
            },

          markReady:
            async () => {
              readyCalls += 1;
            },

          activateSnapshot:
            async () => {
              activationCalls += 1;
            },
        },
      ),
      /validation failed/,
    );

    assert.equal(
      readyCalls,
      0,
    );

    assert.equal(
      activationCalls,
      0,
    );
  },
);

test(
  "rejects validation result without ok true",
  async () => {
    let readyCalls = 0;

    await assert.rejects(
      finalizeEdrSnapshot(
        null,
        {
          snapshotId:
            "snapshot-1",
          organizationCount:
            0,
          fopCount:
            0,
          relationCount:
            0,

          validateSnapshot:
            async () => ({
              ok: false,
            }),

          markReady:
            async () => {
              readyCalls += 1;
            },

          activateSnapshot:
            async () => {},
        },
      ),
      /validation did not succeed/,
    );

    assert.equal(
      readyCalls,
      0,
    );
  },
);

test(
  "does not activate when ready transition fails",
  async () => {
    let activationCalls = 0;

    await assert.rejects(
      finalizeEdrSnapshot(
        null,
        {
          snapshotId:
            "snapshot-1",
          organizationCount:
            3,
          fopCount:
            2,
          relationCount:
            7,

          validateSnapshot:
            async () =>
              validationResult(),

          markReady:
            async () => {
              throw new Error(
                "ready failed",
              );
            },

          activateSnapshot:
            async () => {
              activationCalls += 1;
            },
        },
      ),
      /ready failed/,
    );

    assert.equal(
      activationCalls,
      0,
    );
  },
);

test(
  "propagates activation failure after ready without fallback pointer write",
  async () => {
    let readyCalls = 0;
    let activationCalls = 0;

    await assert.rejects(
      finalizeEdrSnapshot(
        null,
        {
          snapshotId:
            "snapshot-1",
          organizationCount:
            3,
          fopCount:
            2,
          relationCount:
            7,

          validateSnapshot:
            async () =>
              validationResult(),

          markReady:
            async () => {
              readyCalls += 1;

              return {
                id:
                  "snapshot-1",
                status:
                  "ready",
              };
            },

          activateSnapshot:
            async () => {
              activationCalls += 1;

              throw new Error(
                "activation failed",
              );
            },
        },
      ),
      /activation failed/,
    );

    assert.equal(
      readyCalls,
      1,
    );

    assert.equal(
      activationCalls,
      1,
    );
  },
);
