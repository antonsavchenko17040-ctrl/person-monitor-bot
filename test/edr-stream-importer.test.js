import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  EDR_DEFAULT_BATCH_RECORDS,
  importEdrRecordStream,
  importEdrZipFileToSnapshot,
} from "../src/edr-stream-importer.js";

function canonicalRecord(
  index,
  {
    withFounder = true,
  } = {},
) {
  return {
    schema_version:
      "edr-normalized-v1",

    record_type:
      "organization",

    record_number:
      String(index),

    name:
      `ТОВ ${index}`,

    short_name:
      null,

    status:
      "active",

    edrpou:
      `1234567${index}`,

    legal_form:
      null,

    registration:
      null,

    farmer:
      null,

    estate_manager:
      null,

    founders:
      withFounder
        ? [
            `Засновник ${index}`,
          ]
        : [],
    beneficiaries: [],
    signers: [],
    members: [],
    branches: [],
    predecessors: [],
    assignees: [],
    exchange_answers: [],
  };
}

async function* streamRecords(
  count,
) {
  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    yield canonicalRecord(
      index,
    );
  }
}

test(
  "exports default streaming batch size",
  () => {
    assert.equal(
      EDR_DEFAULT_BATCH_RECORDS,
      500,
    );
  },
);

test(
  "streams records into bounded batches with continuous source sequence",
  async () => {
    const calls = [];

    const result =
      await importEdrRecordStream(
        null,
        streamRecords(5),
        {
          snapshotId:
            "snapshot-1",

          batchSize:
            2,

          startSequence:
            10,

          writeBatch:
            async (
              sql,
              batch,
            ) => {
              assert.equal(
                sql,
                null,
              );

              calls.push(
                batch,
              );

              return {
                records_written:
                  batch.records.length,

                relations_written:
                  batch.relations.length,
              };
            },
        },
      );

    assert.deepEqual(
      calls.map(
        (call) =>
          call.records.map(
            (row) =>
              row.source_sequence,
          ),
      ),
      [
        [10, 11],
        [12, 13],
        [14],
      ],
    );

    assert.deepEqual(
      calls.map(
        (call) =>
          call.records.length,
      ),
      [
        2,
        2,
        1,
      ],
    );

    assert.ok(
      calls.every(
        (call) =>
          call.relations.every(
            (row) =>
              call.records.some(
                (record) =>
                  record.source_sequence ===
                    row.source_sequence,
              ),
          ),
        ),
    );

    assert.deepEqual(
      result,
      {
        batches: 3,
        records_seen: 5,
        relations_seen: 5,
        records_written: 5,
        relations_written: 5,
        start_sequence: 10,
        next_sequence: 15,
      },
    );
  },
);

test(
  "reports batch progress after successful writes",
  async () => {
    const progress = [];

    await importEdrRecordStream(
      null,
      [
        canonicalRecord(
          1,
          {
            withFounder:
              false,
          },
        ),
        canonicalRecord(
          2,
          {
            withFounder:
              false,
          },
        ),
        canonicalRecord(
          3,
          {
            withFounder:
              false,
          },
        ),
      ],
      {
        snapshotId:
          "snapshot-1",

        batchSize:
          2,

        writeBatch:
          async (
            sql,
            batch,
          ) => ({
            records_written:
              batch.records.length,

            relations_written:
              batch.relations.length,
          }),

        onBatch:
          async (state) => {
            progress.push(
              state,
            );
          },
      },
    );

    assert.equal(
      progress.length,
      2,
    );

    assert.equal(
      progress[0].records,
      2,
    );

    assert.equal(
      progress[0].next_sequence,
      2,
    );

    assert.equal(
      progress[1].records_seen,
      3,
    );

    assert.equal(
      progress[1].next_sequence,
      3,
    );
  },
);

test(
  "rejects invalid stream options before consuming records",
  async () => {
    let consumed = 0;

    async function* guarded() {
      consumed += 1;
      yield canonicalRecord(1);
    }

    await assert.rejects(
      importEdrRecordStream(
        null,
        guarded(),
        {
          snapshotId:
            "snapshot-1",

          batchSize:
            0,

          writeBatch:
            async () => ({
              records_written: 0,
              relations_written: 0,
            }),
        },
      ),
      /batchSize/,
    );

    await assert.rejects(
      importEdrRecordStream(
        null,
        guarded(),
        {
          snapshotId:
            "snapshot-1",

          startSequence:
            -1,

          writeBatch:
            async () => ({
              records_written: 0,
              relations_written: 0,
            }),
        },
      ),
      /startSequence/,
    );

    assert.equal(
      consumed,
      0,
    );
  },
);

test(
  "rejects silent batch writer count loss",
  async () => {
    await assert.rejects(
      importEdrRecordStream(
        null,
        [
          canonicalRecord(1),
        ],
        {
          snapshotId:
            "snapshot-1",

          writeBatch:
            async () => ({
              records_written:
                0,

              relations_written:
                1,
            }),
        },
      ),
      /record count mismatch/,
    );
  },
);

test(
  "streams normalized ZIP file directly into snapshot batches",
  async () => {
    const ZIP_BASE64 =
      "UEsDBBQAAAAIAPGYCl31fvyOwQAAAFcBAAALAAAAZGF0YS9VTy54bWyzsa/IzVEoSy0qzszPs1Uy1DNQUkjNS85PycxLt1UKDXHTtVCyt+OycXEMcbTjUlCwCQ518nJ1DgGxgbwgV2f/IBc7Qxt9KAsi7Ofo62p3YdGFeRcmKQCJLRd2XNhrow8WhShwdQkK8A+1MzQyNjE1M7ew0YcKQGTd/EP9XFyDgu1gLLsLbRc2XdhwYe+FrUC868I+BZiAjT5MCZwVDHanPpJDsTvaCJ+jp4CMx+ZkC3MzUxNjI0NkJyNZZqMPDikAUEsBAhQDFAAAAAgA8ZgKXfV+/I7BAAAAVwEAAAsAAAAAAAAAAAAAAIABAAAAAGRhdGEvVU8ueG1sUEsFBgAAAAABAAEAOQAAAOoAAAAAAA==";

    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "person-monitor-edr-import-",
        ),
      );

    const zipPath =
      join(
        directory,
        "UO.zip",
      );

    const batches = [];

    try {
      await writeFile(
        zipPath,
        Buffer.from(
          ZIP_BASE64,
          "base64",
        ),
      );

      const result =
        await importEdrZipFileToSnapshot(
          null,
          zipPath,
          {
            snapshotId:
              "snapshot-1",

            recordType:
              "uo",

            batchSize:
              1,

            startSequence:
              100,

            writeBatch:
              async (
                sql,
                batch,
              ) => {
                batches.push(
                  batch,
                );

                return {
                  records_written:
                    batch.records.length,

                  relations_written:
                    batch.relations.length,
                };
              },
          },
        );

      assert.equal(
        result.records_seen,
        2,
      );

      assert.equal(
        result.batches,
        2,
      );

      assert.equal(
        result.next_sequence,
        102,
      );

      assert.deepEqual(
        batches.map(
          (batch) =>
            batch.records[0]
              .record_number,
        ),
        [
          "1",
          "2",
        ],
      );

      assert.deepEqual(
        batches.map(
          (batch) =>
            batch.records[0]
              .source_sequence,
        ),
        [
          100,
          101,
        ],
      );

      assert.ok(
        batches.every(
          (batch) =>
            batch.records[0]
              .record_type ===
            "organization",
        ),
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
