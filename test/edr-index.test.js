import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_INDEX_MAX_RESULTS,
  EDR_INDEX_RELATION_TYPES,
  findActiveEdrRecords,
  findActiveEdrRelations,
} from "../src/edr-index.js";

function fakeSql(
  result = [],
) {
  const calls = [];

  function sql(
    strings,
    ...values
  ) {
    calls.push({
      text:
        strings.join("?"),
      values,
    });

    return Promise.resolve(
      result,
    );
  }

  sql.calls = calls;

  return sql;
}

test(
  "exports index constants",
  () => {
    assert.equal(
      EDR_INDEX_MAX_RESULTS,
      100,
    );

    assert.ok(
      EDR_INDEX_RELATION_TYPES.includes(
        "founder",
      ),
    );

    assert.ok(
      EDR_INDEX_RELATION_TYPES.includes(
        "assignee",
      ),
    );
  },
);

test(
  "finds active records by normalized name",
  async () => {
    const expected = [
      {
        id: 1,
        record_type:
          "organization",
      },
    ];

    const sql =
      fakeSql(expected);

    const result =
      await findActiveEdrRecords(
        sql,
        {
          name:
            "  ТОВ   Тест  ",
        },
      );

    assert.equal(
      result,
      expected,
    );

    assert.equal(
      sql.calls.length,
      1,
    );

    const call =
      sql.calls[0];

    assert.match(
      call.text,
      /edr_active_snapshot/,
    );

    assert.match(
      call.text,
      /r\.normalized_name\s*=/,
    );

    assert.ok(
      call.values.includes(
        "тов тест",
      ),
    );

    assert.ok(
      call.values.includes(
        20,
      ),
    );
  },
);

test(
  "finds active records by exact EDRPOU",
  async () => {
    const sql =
      fakeSql();

    await findActiveEdrRecords(
      sql,
      {
        edrpou:
          " 12345678 ",
        recordType:
          "ORGANIZATION",
        limit: 5,
      },
    );

    const call =
      sql.calls[0];

    assert.match(
      call.text,
      /r\.edrpou\s*=/,
    );

    assert.ok(
      call.values.includes(
        "12345678",
      ),
    );

    assert.ok(
      call.values.includes(
        "organization",
      ),
    );

    assert.ok(
      call.values.includes(
        5,
      ),
    );
  },
);

test(
  "uses combined exact name and EDRPOU query",
  async () => {
    const sql =
      fakeSql();

    await findActiveEdrRecords(
      sql,
      {
        name:
          "Компанія",
        edrpou:
          "87654321",
      },
    );

    const call =
      sql.calls[0];

    assert.match(
      call.text,
      /r\.normalized_name\s*=/,
    );

    assert.match(
      call.text,
      /r\.edrpou\s*=/,
    );

    assert.ok(
      call.values.includes(
        "компанія",
      ),
    );

    assert.ok(
      call.values.includes(
        "87654321",
      ),
    );
  },
);

test(
  "rejects invalid record lookup before SQL",
  async () => {
    const sql =
      fakeSql();

    await assert.rejects(
      findActiveEdrRecords(
        sql,
        {},
      ),
      /name or edrpou is required/,
    );

    await assert.rejects(
      findActiveEdrRecords(
        sql,
        {
          name: "test",
          recordType:
            "person",
        },
      ),
      /Unsupported EDR record type/,
    );

    await assert.rejects(
      findActiveEdrRecords(
        sql,
        {
          name: "test",
          limit:
            EDR_INDEX_MAX_RESULTS +
            1,
        },
      ),
      /limit must be an integer/,
    );

    assert.equal(
      sql.calls.length,
      0,
    );
  },
);

test(
  "finds active relation observations by normalized value",
  async () => {
    const sql =
      fakeSql([
        {
          relation_type:
            "founder",
        },
      ]);

    const result =
      await findActiveEdrRelations(
        sql,
        {
          value:
            "  Іван  Петренко ",
          relationTypes: [
            "founder",
            "beneficiary",
            "founder",
          ],
          limit: 10,
        },
      );

    assert.equal(
      result[0].relation_type,
      "founder",
    );

    const call =
      sql.calls[0];

    assert.match(
      call.text,
      /edr_relation_observations/,
    );

    assert.match(
      call.text,
      /ANY/,
    );

    assert.ok(
      call.values.includes(
        "іван петренко",
      ),
    );

    assert.ok(
      call.values.some(
        (value) =>
          Array.isArray(value) &&
          value.length === 2 &&
          value.includes(
            "founder",
          ) &&
          value.includes(
            "beneficiary",
          ),
      ),
    );

    assert.ok(
      call.values.includes(
        10,
      ),
    );
  },
);

test(
  "relation lookup defaults to indexed relation types",
  async () => {
    const sql =
      fakeSql();

    await findActiveEdrRelations(
      sql,
      {
        value:
          "ТОВ Засновник",
      },
    );

    assert.ok(
      sql.calls[0].values.some(
        (value) =>
          Array.isArray(value) &&
          value.length ===
            EDR_INDEX_RELATION_TYPES.length &&
          value.includes(
            "founder",
          ) &&
          value.includes(
            "branch",
          ),
      ),
    );
  },
);

test(
  "relation lookup validates value, types and limit before SQL",
  async () => {
    const sql =
      fakeSql();

    await assert.rejects(
      findActiveEdrRelations(
        sql,
        {
          value: " ",
        },
      ),
      /value is required/,
    );

    await assert.rejects(
      findActiveEdrRelations(
        sql,
        {
          value: "test",
          relationTypes:
            "founder",
        },
      ),
      /relationTypes must be an array/,
    );

    await assert.rejects(
      findActiveEdrRelations(
        sql,
        {
          value: "test",
          relationTypes: [],
        },
      ),
      /relationTypes must not be empty/,
    );

    await assert.rejects(
      findActiveEdrRelations(
        sql,
        {
          value: "test",
          relationTypes: [
            "unknown",
          ],
        },
      ),
      /Unsupported EDR relation type/,
    );

    await assert.rejects(
      findActiveEdrRelations(
        sql,
        {
          value: "test",
          limit: 0,
        },
      ),
      /limit must be an integer/,
    );

    assert.equal(
      sql.calls.length,
      0,
    );
  },
);
