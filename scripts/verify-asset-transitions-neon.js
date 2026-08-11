import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../src/db.js";

import {
  normalizeText,
} from "../src/utils.js";

import {
  buildAssetTransitionEvents,
} from "../src/asset-transitions.js";

import {
  assessAssetTransitionSet,
} from "../src/asset-transaction-signals.js";

import {
  ASSET_TRANSITION_RELATION_TYPES,
  buildAssetTransitionGraphPlan,
  persistAssetTransitionGraph,
} from "../src/asset-transition-graph.js";

import {
  loadSubjectGraph,
} from "../src/subject-graph.js";

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      "Integration assertion failed: " +
      message,
    );
  }
}

function vehicleFact({
  brand,
  model,
  productionYear,
  acquisitionDate,
  cost,
} = {}) {
  return {
    id:
      randomUUID(),

    fact_type:
      "vehicle",

    value_text:
      [
        brand,
        model,
      ]
        .filter(Boolean)
        .join(" "),

    value_number:
      null,

    source_document_id:
      null,

    value_json: {
      person: {
        role:
          "declarant",
      },

      brand,
      model,

      production_year:
        productionYear,

      acquisition_date:
        acquisitionDate,

      cost,

      rights: [],
    },
  };
}

function incomeFact({
  type,
  amount,
} = {}) {
  return {
    id:
      randomUUID(),

    fact_type:
      "income",

    value_text:
      type,

    value_number:
      amount,

    unit:
      "UAH",

    source_document_id:
      null,

    value_json: {
      person: {
        role:
          "declarant",
      },

      income_type:
        type,

      other_income_type:
        null,

      amount,

      source:
        "INTEGRATION TEST",
    },
  };
}

const sql =
  db();

const runId =
  randomUUID();

const token =
  runId
    .replaceAll("-", "")
    .slice(0, 12);

const subjectId =
  randomUUID();

const subjectEntityId =
  randomUUID();

const subjectName =
  "ІНТЕГРАЦІЙНИЙ СУБЄКТ " +
  token;

const assetEntityIds = [];
const relationIds = [];

try {
  console.log(
    "=== 1. SYNTHETIC SUBJECT ===",
  );

  await sql`
    INSERT INTO entities (
      id,
      entity_type,
      canonical_name,
      normalized_name,
      status,
      metadata
    )
    VALUES (
      ${subjectEntityId},
      ${"person"},
      ${subjectName},
      ${normalizeText(subjectName)},
      ${"active"},
      ${JSON.stringify({
        integration_test: true,
        run_id: runId,
      })}::jsonb
    )
  `;

  await sql`
    INSERT INTO subjects (
      id,
      chat_id,
      full_name,
      aliases,
      organization,
      position,
      city,
      excluded_terms,
      match_threshold,
      enabled,
      created_at,
      last_checked_at,
      entity_id
    )
    VALUES (
      ${subjectId},
      NULL,
      ${subjectName},
      ${JSON.stringify([])}::jsonb,
      ${"INTEGRATION TEST"},
      ${"TEST POSITION"},
      ${"Київ"},
      ${JSON.stringify([])}::jsonb,
      70,
      true,
      now(),
      NULL,
      ${subjectEntityId}
    )
  `;

  console.log(
    "=== 2. DECLARATION FACTS ===",
  );

  const oldVehicle =
    vehicleFact({
      brand:
        "INTEGRATION-OLD-" +
        token,

      model:
        "MODEL-" +
        token,

      productionYear:
        2018,

      acquisitionDate:
        "10.03.2023",

      cost:
        300000,
    });

  const newVehicle =
    vehicleFact({
      brand:
        "INTEGRATION-NEW-" +
        token,

      model:
        "MODEL-" +
        token,

      productionYear:
        2024,

      acquisitionDate:
        "10.05.2025",

      cost:
        650000,
    });

  const oldFacts = [
    oldVehicle,
  ];

  const newFacts = [
    newVehicle,

    incomeFact({
      type:
        "Заробітна плата",

      amount:
        800000,
    }),

    incomeFact({
      type:
        "Дохід від відчуження рухомого майна",

      amount:
        300000,
    }),
  ];

  console.log(
    "=== 3. CROSS-YEAR TRANSITION ===",
  );

  const transition =
    buildAssetTransitionEvents({
      fromYear: 2024,
      toYear: 2025,

      oldFacts,
      newFacts,
    });

  assert(
    transition.appeared.length === 1,
    "one asset must appear",
  );

  assert(
    transition.disappeared.length === 1,
    "one asset must disappear",
  );

  assert(
    transition.appeared[0]
      .transaction_status ===
      "not_inferred",
    "appearance must not become purchase",
  );

  assert(
    transition.disappeared[0]
      .transaction_status ===
      "not_inferred",
    "disappearance must not become sale",
  );

  console.log(
    "✓ transition:",
    transition.summary,
  );

  console.log(
    "=== 4. FINANCIAL SIGNALS ===",
  );

  const financial =
    assessAssetTransitionSet({
      transition,
      toYearFacts:
        newFacts,
    });

  assert(
    financial.appeared[0]
      .financial_status ===
      "acquisition_supported",
    "new asset acquisition must be supported",
  );

  assert(
    financial.appeared[0]
      .transaction_status ===
      "not_inferred",
    "supported acquisition must not become purchase fact",
  );

  assert(
    financial.disappeared[0]
      .financial_status ===
      "disposal_income_candidate",
    "disappeared vehicle must find disposal income candidate",
  );

  assert(
    financial.disappeared[0]
      .transaction_status ===
      "not_inferred",
    "disposal income must not become sale fact",
  );

  console.log(
    "✓ financial:",
    financial.summary,
  );

  console.log(
    "=== 5. GRAPH PLAN ===",
  );

  const plan =
    buildAssetTransitionGraphPlan({
      subjectEntityId,

      transition,

      financialAssessment:
        financial,
    });

  assert(
    plan.nodes.length === 2,
    "graph must contain two asset nodes",
  );

  assert(
    plan.relations.length === 2,
    "graph must contain two transition relations",
  );

  for (const node of plan.nodes) {
    assetEntityIds.push(
      node.id,
    );
  }

  for (
    const relation
    of plan.relations
  ) {
    relationIds.push(
      relation.id,
    );

    assert(
      relation.verificationStatus ===
        "derived",
      "transition relation must be derived",
    );

    assert(
      relation.metadata
        .transaction_status ===
        "not_inferred",
      "graph must preserve neutral transaction status",
    );
  }

  assert(
    plan.relations.some(
      (relation) =>
        relation.relationType ===
        ASSET_TRANSITION_RELATION_TYPES
          .appeared,
    ),
    "appearance relation missing",
  );

  assert(
    plan.relations.some(
      (relation) =>
        relation.relationType ===
        ASSET_TRANSITION_RELATION_TYPES
          .disappeared,
    ),
    "disappearance relation missing",
  );

  console.log(
    "✓ graph plan:",
    plan.stats,
  );

  console.log(
    "=== 6. PERSIST TO NEON ===",
  );

  const persisted =
    await persistAssetTransitionGraph(
      plan,
      {
        sql,
      },
    );

  assert(
    persisted.nodesInserted === 2,
    "two synthetic asset nodes must be inserted",
  );

  assert(
    persisted.relationsInserted === 2,
    "two synthetic relations must be inserted",
  );

  console.log(
    "✓ persisted:",
    persisted,
  );

  console.log(
    "=== 7. DATABASE VERIFICATION ===",
  );

  for (
    const relation
    of plan.relations
  ) {
    const rows =
      await sql`
        SELECT
          relation_type,
          verification_status,
          metadata
        FROM relations
        WHERE id =
          ${relation.id}
        LIMIT 1
      `;

    assert(
      rows.length === 1,
      "persisted relation must exist",
    );

    assert(
      rows[0]
        .verification_status ===
        "derived",
      "database relation must remain derived",
    );

    assert(
      rows[0]
        .metadata
        ?.transaction_status ===
        "not_inferred",
      "database metadata must remain neutral",
    );
  }

  console.log(
    "✓ relations persisted correctly",
  );

  console.log(
    "=== 8. SUBJECT GRAPH ===",
  );

  const graph =
    await loadSubjectGraph(
      subjectId,
      {
        sql,
        year: 2025,
      },
    );

  assert(
    graph,
    "subject graph must load",
  );

  const transitionEdges =
    graph.edges.filter(
      (edge) =>
        edge.type ===
          ASSET_TRANSITION_RELATION_TYPES
            .appeared ||
        edge.type ===
          ASSET_TRANSITION_RELATION_TYPES
            .disappeared,
    );

  assert(
    transitionEdges.length === 2,
    "subject graph must expose both transition edges",
  );

  for (
    const edge
    of transitionEdges
  ) {
    assert(
      edge.verification_status ===
        "derived",
      "subject graph edge must remain derived",
    );

    assert(
      edge.metadata
        ?.transaction_status ===
        "not_inferred",
      "subject graph must not claim purchase or sale",
    );
  }

  assert(
    graph.summary
      .relations[
        ASSET_TRANSITION_RELATION_TYPES
          .appeared
      ] === 1,
    "subject graph appearance count must equal one",
  );

  assert(
    graph.summary
      .relations[
        ASSET_TRANSITION_RELATION_TYPES
          .disappeared
      ] === 1,
    "subject graph disappearance count must equal one",
  );

  console.log(
    "✓ subject graph:",
    {
      nodes:
        graph.summary.nodes,

      edges:
        graph.summary.edges,

      appeared:
        graph.summary
          .relations[
            ASSET_TRANSITION_RELATION_TYPES
              .appeared
          ],

      disappeared:
        graph.summary
          .relations[
            ASSET_TRANSITION_RELATION_TYPES
              .disappeared
          ],
    },
  );

  console.log("");
  console.log(
    "✅ ASSET TRANSITION NEON INTEGRATION PASSED",
  );
} finally {
  console.log(
    "=== 9. CLEANUP ===",
  );

  await sql`
    DELETE FROM relations
    WHERE from_entity_id =
      ${subjectEntityId}
  `;

  for (
    const assetEntityId
    of assetEntityIds
  ) {
    await sql`
      DELETE FROM relations
      WHERE
        from_entity_id =
          ${assetEntityId}
        OR
        to_entity_id =
          ${assetEntityId}
    `;

    await sql`
      DELETE FROM entity_identifiers
      WHERE entity_id =
        ${assetEntityId}
    `;

    await sql`
      DELETE FROM entities
      WHERE id =
        ${assetEntityId}
    `;
  }

  await sql`
    DELETE FROM subjects
    WHERE id =
      ${subjectId}
  `;

  await sql`
    DELETE FROM entity_identifiers
    WHERE entity_id =
      ${subjectEntityId}
  `;

  await sql`
    DELETE FROM entities
    WHERE id =
      ${subjectEntityId}
  `;

  const leftovers =
    await sql`
      SELECT
        (
          SELECT count(*)::int
          FROM subjects
          WHERE id =
            ${subjectId}
        ) AS subjects,

        (
          SELECT count(*)::int
          FROM entities
          WHERE id =
            ${subjectEntityId}
        ) AS subject_entities,

        (
          SELECT count(*)::int
          FROM relations
          WHERE from_entity_id =
            ${subjectEntityId}
        ) AS relations
    `;

  assert(
    leftovers[0].subjects === 0,
    "synthetic subject cleanup failed",
  );

  assert(
    leftovers[0]
      .subject_entities === 0,
    "synthetic subject entity cleanup failed",
  );

  assert(
    leftovers[0].relations === 0,
    "synthetic relation cleanup failed",
  );

  console.log(
    "✓ cleanup complete",
  );
}
