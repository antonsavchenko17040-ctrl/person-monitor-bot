import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeEdrGraphMetadata,
  persistEdrSubjectRelationPlan,
} from "../src/edr-relation-store.js";

function graphPlan() {
  return {
    version:
      "edr-relations-v1",

    nodes: [
      {
        id:
          "11111111-1111-5111-8111-111111111111",
        entityType:
          "organization",
        canonicalName:
          "ТОВ ТЕСТ",
        identifier: {
          type: "edrpou",
          value: "12345678",
          normalized:
            "12345678",
          confidence: 100,
        },
        metadata: {
          source: "edr",
          edrpou:
            "12345678",
        },
      },
    ],

    relations: [
      {
        id:
          "22222222-2222-5222-8222-222222222222",
        fromEntityId:
          "33333333-3333-5333-8333-333333333333",
        toEntityId:
          "11111111-1111-5111-8111-111111111111",
        relationType:
          "edr_founder_of",
        validFrom: null,
        validTo: null,
        confidence: 70,
        verificationStatus:
          "manual_review",
        metadata: {
          source: "edr",
          observation_ids: [
            "observation-2",
          ],
          snapshot_ids: [
            "snapshot-2",
          ],
          evidence_count: 1,
        },
      },
    ],
  };
}

function fakeSql({
  entityRows = [],
  identifierRows = [],
  relationRows = [],
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
          "SELECT id, metadata FROM entities",
        )
      ) {
        return entityRows;
      }

      if (
        text.includes(
          "SELECT id FROM entity_identifiers",
        )
      ) {
        return identifierRows;
      }

      if (
        text.includes(
          "SELECT id, confidence, metadata FROM relations",
        )
      ) {
        return relationRows;
      }

      return [];
    };

  sql.calls = calls;

  return sql;
}

test("merges EDR provenance without losing historical observations", () => {
  const metadata =
    mergeEdrGraphMetadata(
      {
        source: "edr",
        sources: [
          "nazk-declaration",
          "edr",
        ],
        observation_ids: [
          "observation-1",
        ],
        snapshot_ids: [
          "snapshot-1",
        ],
      },
      {
        source: "edr",
        observation_ids: [
          "observation-2",
        ],
        snapshot_ids: [
          "snapshot-2",
        ],
      },
    );

  assert.deepEqual(
    metadata.sources,
    [
      "edr",
      "nazk-declaration",
    ],
  );

  assert.deepEqual(
    metadata.observation_ids,
    [
      "observation-1",
      "observation-2",
    ],
  );

  assert.deepEqual(
    metadata.snapshot_ids,
    [
      "snapshot-1",
      "snapshot-2",
    ],
  );

  assert.equal(
    metadata.evidence_count,
    2,
  );
});

test("requires graph plan before database access", async () => {
  const sql =
    fakeSql();

  await assert.rejects(
    () =>
      persistEdrSubjectRelationPlan(
        {},
        { sql },
      ),
    /plan nodes and relations are required/,
  );

  assert.equal(
    sql.calls.length,
    0,
  );
});

test("rejects automatically verified EDR relation before database access", async () => {
  const plan =
    graphPlan();

  plan.relations[0]
    .verificationStatus =
    "source_extracted";

  const sql =
    fakeSql();

  await assert.rejects(
    () =>
      persistEdrSubjectRelationPlan(
        plan,
        { sql },
      ),
    /must require manual review/,
  );

  assert.equal(
    sql.calls.length,
    0,
  );
});

test("rejects non EDR organization node", async () => {
  const plan =
    graphPlan();

  plan.nodes[0]
    .metadata.source =
    "other-source";

  const sql =
    fakeSql();

  await assert.rejects(
    () =>
      persistEdrSubjectRelationPlan(
        plan,
        { sql },
      ),
    /Invalid EDR organization graph node/,
  );

  assert.equal(
    sql.calls.length,
    0,
  );
});

test("inserts new EDR node identifier and relation", async () => {
  const sql =
    fakeSql();

  const result =
    await persistEdrSubjectRelationPlan(
      graphPlan(),
      { sql },
    );

  assert.deepEqual(
    result,
    {
      nodesInserted: 1,
      nodesUpdated: 0,
      identifiersInserted: 1,
      relationsInserted: 1,
      relationsUpdated: 0,
    },
  );

  assert.ok(
    sql.calls.some(
      ({ text }) =>
        text.includes(
          "INSERT INTO entities",
        ),
    ),
  );

  assert.ok(
    sql.calls.some(
      ({ text }) =>
        text.includes(
          "INSERT INTO entity_identifiers",
        ) &&
        text.includes(
          "edr",
        ),
    ),
  );

  assert.ok(
    sql.calls.some(
      ({ text }) =>
        text.includes(
          "INSERT INTO relations",
        ) &&
        text.includes(
          "manual_review",
        ),
    ),
  );
});

test("updates existing node and relation without duplicate identifier", async () => {
  const sql =
    fakeSql({
      entityRows: [
        {
          id: "existing",
          metadata: {
            identification:
              "edrpou",
          },
        },
      ],

      identifierRows: [
        {
          id: "identifier-1",
        },
      ],

      relationRows: [
        {
          id: "relation-1",
          confidence: 75,
          metadata: {
            source: "edr",
            observation_ids: [
              "observation-1",
            ],
            snapshot_ids: [
              "snapshot-1",
            ],
          },
        },
      ],
    });

  const result =
    await persistEdrSubjectRelationPlan(
      graphPlan(),
      { sql },
    );

  assert.deepEqual(
    result,
    {
      nodesInserted: 0,
      nodesUpdated: 1,
      identifiersInserted: 0,
      relationsInserted: 0,
      relationsUpdated: 1,
    },
  );

  assert.equal(
    sql.calls.filter(
      ({ text }) =>
        text.includes(
          "INSERT INTO entity_identifiers",
        ),
    ).length,
    0,
  );

  const relationInsert =
    sql.calls.find(
      ({ text }) =>
        text.includes(
          "INSERT INTO relations",
        ),
    );

  assert.ok(
    relationInsert,
  );

  assert.ok(
    relationInsert.values.includes(
      75,
    ),
  );

  const metadata =
    relationInsert.values
      .map((value) => {
        if (
          typeof value !==
          "string"
        ) {
          return null;
        }

        try {
          return JSON.parse(
            value,
          );
        } catch {
          return null;
        }
      })
      .find(
        (value) =>
          value?.observation_ids,
      );

  assert.deepEqual(
    metadata.observation_ids,
    [
      "observation-1",
      "observation-2",
    ],
  );
});

test("empty plan performs no database writes", async () => {
  const sql =
    fakeSql();

  const result =
    await persistEdrSubjectRelationPlan(
      {
        version:
          "edr-relations-v1",
        nodes: [],
        relations: [],
      },
      { sql },
    );

  assert.equal(
    sql.calls.length,
    0,
  );

  assert.deepEqual(
    result,
    {
      nodesInserted: 0,
      nodesUpdated: 0,
      identifiersInserted: 0,
      relationsInserted: 0,
      relationsUpdated: 0,
    },
  );
});
