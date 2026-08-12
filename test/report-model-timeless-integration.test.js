import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubjectReportModel,
} from "../src/report-model.js";


test(
  "report loader wires timeless EDR relations once without declaration year",
  async () => {
    const subjectEntityId =
      "11111111-1111-5111-8111-111111111111";

    const relationId =
      "22222222-2222-5222-8222-222222222222";

    const calls = [];

    const report =
      await buildSubjectReportModel(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        {
          generatedAt:
            new Date(
              "2026-08-12T00:00:00.000Z",
            ),

          subjectLoader:
            async () => ({
              id:
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

              entity_id:
                subjectEntityId,

              full_name:
                "Тестовий Суб’єкт",
            }),

          declarationYearsLoader:
            async () => [],

          timelessRelationsOptions: {
            marker:
              "timeless-test",
          },

          timelessRelationsLoader:
            async (
              entityId,
              options,
            ) => {
              calls.push({
                entityId,
                options,
              });

              return [{
                relation_id:
                  relationId,

                relation_type:
                  "edr_founder_of",

                relation_scope:
                  "timeless",

                source_document_id:
                  null,

                valid_from:
                  null,

                valid_to:
                  null,

                confidence:
                  70,

                verification_status:
                  "manual_review",

                metadata: {
                  source:
                    "edr",

                  edr_relation_type:
                    "founder",

                  review_required:
                    true,
                },

                from_entity_id:
                  subjectEntityId,

                from_entity_type:
                  "person",

                from_name:
                  "Тестовий Суб’єкт",

                from_metadata: {},

                to_entity_id:
                  "33333333-3333-5333-8333-333333333333",

                to_entity_type:
                  "organization",

                to_name:
                  "Тестова Організація",

                to_metadata: {
                  edrpou:
                    "12345678",
                },
              }];
            },

          mentionsLoader:
            async () => [],

          sourceDocumentsLoader:
            async () => [],
        },
      );

    assert.equal(
      calls.length,
      1,
    );

    assert.equal(
      calls[0].entityId,
      subjectEntityId,
    );

    assert.deepEqual(
      calls[0].options,
      {
        marker:
          "timeless-test",
      },
    );

    assert.equal(
      report.relations.items.length,
      1,
    );

    assert.deepEqual(
      {
        relation_id:
          report.relations.items[0]
            .relation_id,

        relation_type:
          report.relations.items[0]
            .relation_type,

        relation_scope:
          report.relations.items[0]
            .relation_scope,

        year:
          report.relations.items[0]
            .year,

        confidence:
          report.relations.items[0]
            .confidence,

        verification_status:
          report.relations.items[0]
            .verification_status,
      },
      {
        relation_id:
          relationId,

        relation_type:
          "edr_founder_of",

        relation_scope:
          "timeless",

        year:
          null,

        confidence:
          70,

        verification_status:
          "manual_review",
      },
    );

    assert.deepEqual(
      report.manual_review.items,
      [{
        source_path:
          "relations.items",

        item_ref:
          relationId,

        review_type:
          "identity_resolution",
      }],
    );

    assert.deepEqual(
      report.analytics.metrics,
      [],
    );
  },
);



test(
  "timeless EDR relations are deduplicated and excluded from yearly relation metrics",
  async () => {
    const {
      buildRelationsSection,
      buildReportAnalyticsSection,
    } =
      await import(
        "../src/report-model.js"
      );

    const subjectEntityId =
      "11111111-1111-5111-8111-111111111111";

    const yearlyRelationId =
      "22222222-2222-5222-8222-222222222222";

    const timelessRelationId =
      "33333333-3333-5333-8333-333333333333";

    const timelessRelation = {
      relation_id:
        timelessRelationId,

      relation_type:
        "edr_founder_of",

      relation_scope:
        "timeless",

      source_document_id:
        null,

      valid_from:
        null,

      valid_to:
        null,

      confidence:
        70,

      verification_status:
        "manual_review",

      metadata: {
        source:
          "edr",

        review_required:
          true,
      },

      from_entity_id:
        subjectEntityId,

      from_entity_type:
        "person",

      from_name:
        "Тестовий Суб’єкт",

      from_metadata: {},

      to_entity_id:
        "44444444-4444-5444-8444-444444444444",

      to_entity_type:
        "organization",

      to_name:
        "Тестова Організація",

      to_metadata: {},
    };

    const relations =
      buildRelationsSection({
        contexts: [{
          detected_years: [
            2025,
          ],

          analytics: {
            yearly: [{
              sourceDocumentId:
                null,
            }],
          },

          source_documents: [],

          relations: [{
            id:
              yearlyRelationId,

            relation_type:
              "employed_by",

            relation_scope:
              "direct",

            from_entity_id:
              subjectEntityId,

            to_entity_id:
              "55555555-5555-5555-8555-555555555555",

            from_entity_type:
              "person",

            to_entity_type:
              "organization",

            metadata: {},
          }],
        }],

        timelessRelations: [
          timelessRelation,
          {
            ...timelessRelation,
          },
        ],
      });

    assert.equal(
      relations.items.length,
      2,
    );

    assert.equal(
      relations.items.filter(
        (item) =>
          item.relation_id ===
            timelessRelationId,
      ).length,
      1,
    );

    const timelessItem =
      relations.items.find(
        (item) =>
          item.relation_id ===
            timelessRelationId,
      );

    assert.equal(
      timelessItem.year,
      null,
    );

    assert.equal(
      timelessItem.label,
      "Засновник (ЄДР)",
    );

    assert.equal(
      timelessItem.statement_type,
      "heuristic_signal",
    );

    assert.deepEqual(
      relations.counts,
      {
        employed_by:
          1,

        edr_founder_of:
          1,
      },
    );

    const analytics =
      buildReportAnalyticsSection({
        availableYears: [
          2025,
        ],

        income: {
          yearly: [],
        },

        cashAssets: {
          yearly: [],
        },

        realEstate: {
          yearly: [],
        },

        vehicles: {
          yearly: [],
        },

        career: {
          items: [],
          transitions: [],
        },

        relations,
      });

    assert.equal(
      analytics.metrics.length,
      1,
    );

    assert.equal(
      analytics.metrics[0]
        .year,
      2025,
    );

    assert.equal(
      analytics.metrics[0]
        .relation_count,
      1,
    );
  },
);
