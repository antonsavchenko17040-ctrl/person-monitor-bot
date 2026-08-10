import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_MAX_BATCH_RECORDS,
  writeEdrImportBatch,
} from "../src/edr-batch-writer.js";

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

function record(
  sourceSequence,
) {
  return {
    source_sequence:
      sourceSequence,

    record_type:
      "organization",

    record_number:
      String(
        sourceSequence,
      ),

    name:
      `ТОВ ${sourceSequence}`,

    normalized_name:
      `тов ${sourceSequence}`,

    short_name:
      null,

    edrpou:
      `1234567${sourceSequence}`,

    status:
      "active",

    legal_form:
      null,

    registration:
      null,

    farmer:
      null,

    estate_manager:
      null,

    content_hash:
      "a".repeat(
        64,
      ),

    details: {},
  };
}

test(
  "exports maximum EDR batch size",
  () => {
    assert.equal(
      EDR_MAX_BATCH_RECORDS,
      1000,
    );
  },
);

test(
  "writes records and relations in one SQL statement",
  async () => {
    let calls = 0;

    const sql =
      async (
        strings,
        ...values
      ) => {
        calls += 1;

        const text =
          queryText(
            strings,
          );

        assert.match(
          text,
          /jsonb_to_recordset/,
        );

        assert.match(
          text,
          /ON CONFLICT \( snapshot_id, source_sequence \)/,
        );

        assert.match(
          text,
          /ON CONFLICT \( snapshot_id, record_id, relation_type, ordinal \)/,
        );

        assert.match(
          text,
          /status = 'staging'/,
        );

        assert.equal(
          values.length,
          3,
        );

        assert.equal(
          values[0],
          "snapshot-1",
        );

        const records =
          JSON.parse(
            values[1],
          );

        const relations =
          JSON.parse(
            values[2],
          );

        assert.equal(
          records.length,
          2,
        );

        assert.equal(
          relations.length,
          1,
        );

        return [
          {
            candidate_exists:
              true,

            records_written:
              2,

            relations_written:
              1,
          },
        ];
      };

    const result =
      await writeEdrImportBatch(
        sql,
        {
          snapshotId:
            "snapshot-1",

          records: [
            record(0),
            record(1),
          ],

          relations: [
            {
              source_sequence:
                0,

              relation_type:
                "founder",

              ordinal:
                0,

              value_text:
                "Іваненко Іван",

              normalized_value:
                "іваненко іван",

              value_code:
                null,

              metadata: {},
            },
          ],
        },
      );

    assert.equal(
      calls,
      1,
    );

    assert.deepEqual(
      result,
      {
        records_written:
          2,

        relations_written:
          1,
      },
    );
  },
);

test(
  "allows a batch without relations",
  async () => {
    const result =
      await writeEdrImportBatch(
        async (
          strings,
          ...values
        ) => {
          assert.match(
            queryText(
              strings,
            ),
            /input_relations/,
          );

          assert.deepEqual(
            JSON.parse(
              values[2],
            ),
            [],
          );

          return [
            {
              candidate_exists:
                true,

              records_written:
                1,

              relations_written:
                0,
            },
          ];
        },
        {
          snapshotId:
            "snapshot-1",

          records: [
            record(5),
          ],
        },
      );

    assert.equal(
      result.records_written,
      1,
    );

    assert.equal(
      result.relations_written,
      0,
    );
  },
);

test(
  "rejects invalid batch shape before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      writeEdrImportBatch(
        sql,
        {
          snapshotId:
            "snapshot-1",

          records: [],
        },
      ),
      /must not be empty/,
    );

    await assert.rejects(
      writeEdrImportBatch(
        sql,
        {
          snapshotId:
            "snapshot-1",

          records: [
            record(1),
            record(1),
          ],
        },
      ),
      /must be unique/,
    );

    await assert.rejects(
      writeEdrImportBatch(
        sql,
        {
          snapshotId:
            "snapshot-1",

          records: [
            record(1),
          ],

          relations: [
            {
              source_sequence:
                2,

              relation_type:
                "founder",

              ordinal:
                0,
            },
          ],
        },
      ),
      /same batch/,
    );

    assert.equal(
      calls,
      0,
    );
  },
);

test(
  "rejects batch larger than configured maximum",
  async () => {
    const records =
      Array.from(
        {
          length:
            EDR_MAX_BATCH_RECORDS +
            1,
        },
        (_, index) =>
          record(
            index,
          ),
      );

    await assert.rejects(
      writeEdrImportBatch(
        async () => [],
        {
          snapshotId:
            "snapshot-1",

          records,
        },
      ),
      /maximum batch size/,
    );
  },
);

test(
  "rejects write when snapshot is not staging",
  async () => {
    await assert.rejects(
      writeEdrImportBatch(
        async () => [
          {
            candidate_exists:
              false,

            records_written:
              0,

            relations_written:
              0,
          },
        ],
        {
          snapshotId:
            "snapshot-1",

          records: [
            record(0),
          ],
        },
      ),
      /not staging/,
    );
  },
);
