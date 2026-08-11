import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSET_TRANSITION_GRAPH_VERSION,
  ASSET_TRANSITION_RELATION_TYPES,
  buildAssetTransitionGraphPlan,
} from "../src/asset-transition-graph.js";

import {
  GRAPH_RELATION_LABELS,
  safeRelationMetadata,
} from "../src/subject-graph.js";

const SUBJECT_ID =
  "11111111-1111-4111-8111-111111111111";

function vehicleFact({
  sourceDocumentId =
    "22222222-2222-4222-8222-222222222222",
} = {}) {
  return {
    id:
      "33333333-3333-4333-8333-333333333333",

    fact_type:
      "vehicle",

    value_text:
      "Toyota Camry",

    value_number:
      null,

    source_document_id:
      sourceDocumentId,

    value_json: {
      person: {
        role:
          "declarant",
      },

      brand:
        "Toyota",

      model:
        "Camry",

      production_year:
        2020,

      acquisition_date:
        "15.06.2025",

      cost:
        600000,

      rights: [],
    },
  };
}

function event({
  eventType =
    "appeared",
  gap = 1,
} = {}) {
  return {
    event_type:
      eventType,

    asset_type:
      "vehicle",

    asset_key:
      "vehicle|toyota|camry|2020",

    from_year:
      2025 - gap,

    to_year:
      2025,

    year_gap:
      gap,

    transaction_status:
      "not_inferred",

    fact:
      vehicleFact(),
  };
}

test(
  "exports transition graph version",
  () => {
    assert.equal(
      ASSET_TRANSITION_GRAPH_VERSION,
      "asset-transition-graph-v1",
    );
  },
);

test(
  "appeared event creates neutral derived graph relation",
  () => {
    const plan =
      buildAssetTransitionGraphPlan({
        subjectEntityId:
          SUBJECT_ID,

        transition: {
          appeared: [
            event(),
          ],

          disappeared: [],
        },
      });

    assert.equal(
      plan.stats.nodes,
      1,
    );

    assert.equal(
      plan.stats.relations,
      1,
    );

    const relation =
      plan.relations[0];

    assert.equal(
      relation.relationType,
      ASSET_TRANSITION_RELATION_TYPES
        .appeared,
    );

    assert.equal(
      relation.verificationStatus,
      "derived",
    );

    assert.equal(
      relation.metadata
        .transaction_status,
      "not_inferred",
    );
  },
);

test(
  "disappeared event creates disappearance relation",
  () => {
    const plan =
      buildAssetTransitionGraphPlan({
        subjectEntityId:
          SUBJECT_ID,

        transition: {
          appeared: [],

          disappeared: [
            event({
              eventType:
                "disappeared",
            }),
          ],
        },
      });

    assert.equal(
      plan.relations[0]
        .relationType,
      ASSET_TRANSITION_RELATION_TYPES
        .disappeared,
    );
  },
);

test(
  "financial assessment is copied as evidence, not transaction fact",
  () => {
    const transitionEvent =
      event();

    const plan =
      buildAssetTransitionGraphPlan({
        subjectEntityId:
          SUBJECT_ID,

        transition: {
          appeared: [
            transitionEvent,
          ],

          disappeared: [],
        },

        financialAssessment: {
          appeared: [
            {
              event_type:
                "appeared",

              asset_key:
                transitionEvent.asset_key,

              temporal_precision:
                "consecutive",

              financial_status:
                "acquisition_supported",

              transaction_status:
                "not_inferred",

              declared_income_uah:
                800000,

              acquisition: {
                declared_cost_uah:
                  600000,

                cost_income_ratio:
                  0.75,
              },

              disposal:
                null,

              findings: [
                {
                  code:
                    "declared_acquisition_date",

                  strength:
                    "supporting",
                },
              ],
            },
          ],

          disappeared: [],
        },
      });

    const metadata =
      plan.relations[0]
        .metadata;

    assert.equal(
      metadata.financial_status,
      "acquisition_supported",
    );

    assert.equal(
      metadata.transaction_status,
      "not_inferred",
    );

    assert.equal(
      metadata.declared_cost_uah,
      600000,
    );

    assert.deepEqual(
      metadata.signal_codes,
      [
        "declared_acquisition_date",
      ],
    );
  },
);

test(
  "gap lowers transition confidence",
  () => {
    const consecutive =
      buildAssetTransitionGraphPlan({
        subjectEntityId:
          SUBJECT_ID,

        transition: {
          appeared: [
            event({
              gap: 1,
            }),
          ],

          disappeared: [],
        },
      });

    const gap =
      buildAssetTransitionGraphPlan({
        subjectEntityId:
          SUBJECT_ID,

        transition: {
          appeared: [
            event({
              gap: 3,
            }),
          ],

          disappeared: [],
        },
      });

    assert.ok(
      gap.relations[0].confidence <
      consecutive.relations[0].confidence,
    );

    assert.equal(
      gap.relations[0]
        .metadata
        .temporal_precision,
      "reduced_gap",
    );
  },
);

test(
  "weak asset does not create competing graph node",
  () => {
    const weak =
      event();

    weak.fact.value_json = {
      brand:
        "Toyota",
    };

    const plan =
      buildAssetTransitionGraphPlan({
        subjectEntityId:
          SUBJECT_ID,

        transition: {
          appeared: [
            weak,
          ],

          disappeared: [],
        },
      });

    assert.equal(
      plan.stats.nodes,
      0,
    );

    assert.equal(
      plan.stats.relations,
      0,
    );

    assert.equal(
      plan.stats.weakAssetsSkipped,
      1,
    );
  },
);

test(
  "transition relation identifiers are deterministic",
  () => {
    const input = {
      subjectEntityId:
        SUBJECT_ID,

      transition: {
        appeared: [
          event(),
        ],

        disappeared: [],
      },
    };

    const first =
      buildAssetTransitionGraphPlan(
        input,
      );

    const second =
      buildAssetTransitionGraphPlan(
        input,
      );

    assert.equal(
      first.nodes[0].id,
      second.nodes[0].id,
    );

    assert.equal(
      first.relations[0].id,
      second.relations[0].id,
    );
  },
);

test(
  "subject graph exposes transition relation labels",
  () => {
    assert.equal(
      GRAPH_RELATION_LABELS[
        "asset_appeared_in_declaration"
      ],
      "З’явився у декларації",
    );

    assert.equal(
      GRAPH_RELATION_LABELS[
        "asset_disappeared_from_declaration"
      ],
      "Вибув із декларації",
    );
  },
);

test(
  "subject graph keeps safe transition metadata",
  () => {
    const result =
      safeRelationMetadata({
        transition_event:
          "appeared",

        from_year:
          2024,

        to_year:
          2025,

        financial_status:
          "acquisition_supported",

        transaction_status:
          "not_inferred",

        signal_codes: [
          "declared_acquisition_date",
        ],

        secret_field:
          "must not leak",
      });

    assert.equal(
      result.transition_event,
      "appeared",
    );

    assert.equal(
      result.transaction_status,
      "not_inferred",
    );

    assert.deepEqual(
      result.signal_codes,
      [
        "declared_acquisition_date",
      ],
    );

    assert.equal(
      result.secret_field,
      undefined,
    );
  },
);
