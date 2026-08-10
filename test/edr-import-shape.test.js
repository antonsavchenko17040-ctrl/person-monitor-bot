import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeEdrLookupText,
  stableEdrJson,
  buildEdrContentHash,
  buildEdrImportRow,
  buildEdrRelationRows,
} from "../src/edr-import-shape.js";

function record() {
  return {
    schema_version:
      "edr-normalized-v1",
    record_type:
      "organization",
    record_number:
      "42",
    name:
      " ТОВ   Приклад ",
    short_name:
      "ТОВ П",
    edrpou:
      "12345678",
    status:
      "зареєстровано",
    legal_form:
      "Товариство",
    registration:
      "2020-01-01",
    purpose:
      "Діяльність",
    founders: [
      " Іваненко Іван ",
      "ТОВ Засновник",
    ],
    beneficiaries: [
      "Петренко Петро",
    ],
    signers: [
      "Директор",
    ],
    members: [
      "Учасник",
    ],
    executive_power: {
      name:
        " Міністерство ",
      code:
        "999",
    },
    superior_management:
      "Наглядова рада",
    branches: [
      {
        code:
          "001",
        name:
          " Київська філія ",
        signer:
          "Керівник",
        create_date:
          "2020-02-01",
      },
    ],
    predecessors: [
      {
        name:
          "Попередник",
        code:
          "11111111",
      },
    ],
    assignees: [],
    exchange_answers: [],
  };
}

test(
  "normalizes EDR lookup text",
  () => {
    assert.equal(
      normalizeEdrLookupText(
        " ТОВ   Приклад ",
      ),
      "тов приклад",
    );
  },
);

test(
  "stable JSON and hash ignore object key order",
  () => {
    assert.equal(
      stableEdrJson({
        b: 2,
        a: 1,
      }),
      stableEdrJson({
        a: 1,
        b: 2,
      }),
    );

    assert.equal(
      buildEdrContentHash({
        b: 2,
        a: 1,
      }),
      buildEdrContentHash({
        a: 1,
        b: 2,
      }),
    );
  },
);

test(
  "builds compact indexed EDR import row",
  () => {
    const row =
      buildEdrImportRow(
        record(),
        {
          sourceSequence: 5,
        },
      );

    assert.equal(
      row.source_sequence,
      5,
    );
    assert.equal(
      row.normalized_name,
      "тов приклад",
    );
    assert.equal(
      row.content_hash.length,
      64,
    );
    assert.equal(
      row.details.purpose,
      "Діяльність",
    );
    assert.equal(
      "founders" in row.details,
      false,
    );
    assert.equal(
      "branches" in row.details,
      false,
    );
  },
);

test(
  "builds relation rows with stable ordinal and codes",
  () => {
    const rows =
      buildEdrRelationRows(
        record(),
        {
          sourceSequence: 12,
        },
      );

    const founders =
      rows.filter(
        (row) =>
          row.relation_type ===
            "founder",
      );

    assert.deepEqual(
      founders.map(
        (row) => [
          row.ordinal,
          row.value_text,
        ],
      ),
      [
        [
          0,
          "Іваненко Іван",
        ],
        [
          1,
          "ТОВ Засновник",
        ],
      ],
    );

    const branch =
      rows.find(
        (row) =>
          row.relation_type ===
            "branch",
      );

    assert.equal(
      branch.source_sequence,
      12,
    );
    assert.equal(
      branch.value_code,
      "001",
    );
    assert.equal(
      branch.metadata.signer,
      "Керівник",
    );

    assert.ok(
      rows.some(
        (row) =>
          row.relation_type ===
            "predecessor" &&
          row.value_code ===
            "11111111",
      ),
    );
  },
);

test(
  "rejects unsupported record types and invalid sequence",
  () => {
    assert.throws(
      () =>
        buildEdrImportRow(
          {
            record_type:
              "unknown",
            record_number:
              "1",
          },
          {
            sourceSequence:
              0,
          },
        ),
      /Unsupported EDR record type/,
    );

    assert.throws(
      () =>
        buildEdrRelationRows(
          {},
          {
            sourceSequence:
              -1,
          },
        ),
      /sourceSequence/,
    );
  },
);
