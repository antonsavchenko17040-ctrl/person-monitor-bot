import test from "node:test";
import assert from "node:assert/strict";

import {
  loadEdrSnapshotRelations,
} from "../src/edr-snapshot-relations.js";

test(
  "loads relation observations joined with parent record identity",
  async () => {
    const expected = [
      {
        id: 1,
        snapshot_id:
          "snapshot-a",
        record_id: 10,
        relation_type:
          "founder",
        ordinal: 0,
        value_text:
          "ІВАНЕНКО ІВАН",
        normalized_value:
          "іваненко іван",
        value_code:
          null,
        record_type:
          "organization",
        record_name:
          "ТОВ ТЕСТ",
        record_edrpou:
          "12345678",
      },
    ];

    const calls = [];

    const sql =
      async (
        strings,
        ...values
      ) => {
        const text =
          strings.join("?");

        calls.push({
          text,
          values,
        });

        return expected;
      };

    const result =
      await loadEdrSnapshotRelations(
        sql,
        "snapshot-a",
      );

    assert.deepEqual(
      result,
      expected,
    );

    assert.equal(
      calls.length,
      1,
    );

    assert.deepEqual(
      calls[0].values,
      ["snapshot-a"],
    );

    assert.ok(
      calls[0].text.includes(
        "FROM edr_relation_observations",
      ),
    );

    assert.ok(
      calls[0].text.includes(
        "JOIN edr_records",
      ),
    );

    assert.ok(
      calls[0].text.includes(
        "record.edrpou",
      ),
    );
  },
);
