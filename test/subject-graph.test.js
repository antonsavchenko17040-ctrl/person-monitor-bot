import test from "node:test";
import assert from "node:assert/strict";

import {
  GRAPH_RELATION_LABELS,
  GRAPH_TIMELESS_RELATION_TYPES,
  safeEntityMetadata,
  safeRelationMetadata,
  buildSubjectGraphPayload,
  loadSubjectGraph,
} from "../src/subject-graph.js";

const REQUIRED_RELATIONS = [
  "employed_by",
  "declared_asset",
  "income_from",
  "family_member_observed",
  "third_party_rightsholder",
  "resolved_to",
  "edr_founder_of",
  "edr_beneficiary_of",
  "edr_signer_of",
  "edr_member_of",
  "edr_executive_power_of",
  "edr_superior_management_of",
];

test(
  "subject graph exports required helpers",
  () => {
    assert.equal(
      typeof safeEntityMetadata,
      "function",
    );

    assert.equal(
      typeof safeRelationMetadata,
      "function",
    );

    assert.equal(
      typeof buildSubjectGraphPayload,
      "function",
    );

    assert.equal(
      typeof loadSubjectGraph,
      "function",
    );
  },
);

test(
  "supported graph relations have labels",
  () => {
    for (
      const relation of
      REQUIRED_RELATIONS
    ) {
      assert.equal(
        typeof GRAPH_RELATION_LABELS[
          relation
        ],
        "string",
      );

      assert.ok(
        GRAPH_RELATION_LABELS[
          relation
        ].trim(),
      );
    }
  },
);

test(
  "empty subject graph contains only root node",
  () => {
    const subject = {
      id:
        "00000000-0000-4000-8000-000000000001",

      entity_id:
        "00000000-0000-4000-8000-000000000001",

      full_name:
        "Тестова Особа",

      organization:
        "Тестова організація",

      position:
        "Тестова посада",

      city:
        "Київ",
    };

    const graph =
      buildSubjectGraphPayload({
        subject,
        year: 2025,
        availableYears: [
          2025,
          2024,
        ],
        rows: [],
      });

    assert.ok(
      graph &&
      typeof graph === "object",
    );

    assert.deepEqual(
      graph.available_years,
      [
        2025,
        2024,
      ],
    );

    assert.equal(
      graph.year,
      2025,
    );

    assert.ok(
      Array.isArray(
        graph.nodes,
      ),
    );

    assert.ok(
      Array.isArray(
        graph.edges,
      ),
    );

    assert.equal(
      graph.nodes.length,
      1,
    );

    assert.equal(
      graph.edges.length,
      0,
    );

    assert.equal(
      graph.nodes[0].id,
      subject.entity_id,
    );

    assert.equal(
      graph.nodes[0].entity_type,
      "person",
    );
  },
);


test(
  "EDR relations are marked as timeless graph relations",
  () => {
    assert.deepEqual(
      GRAPH_TIMELESS_RELATION_TYPES,
      [
        "edr_founder_of",
        "edr_beneficiary_of",
        "edr_signer_of",
        "edr_member_of",
        "edr_executive_power_of",
        "edr_superior_management_of",
      ],
    );
  },
);

test(
  "subject graph exposes safe EDR relation metadata and review status",
  () => {
    const subjectId =
      "00000000-0000-4000-8000-000000000001";

    const organizationId =
      "00000000-0000-5000-8000-000000000002";

    const graph =
      buildSubjectGraphPayload({
        subject: {
          subject_id: subjectId,
          entity_id: subjectId,
          full_name: "Тестова Особа",
        },
        year: 2025,
        availableYears: [2025],
        rows: [
          {
            relation_id:
              "00000000-0000-5000-8000-000000000003",
            relation_type:
              "edr_founder_of",
            valid_from: null,
            valid_to: null,
            confidence: 70,
            verification_status:
              "manual_review",
            relation_metadata: {
              source: "edr",
              edr_relation_type:
                "founder",
              organization_name:
                "ТОВ ТЕСТ",
              organization_edrpou:
                "12345678",
              identity_status:
                "ambiguous",
              identity_decision:
                "manual_review",
              review_required: true,
              observation_ids: [
                "internal-observation",
              ],
              snapshot_ids: [
                "internal-snapshot",
              ],
            },
            from_id: subjectId,
            from_entity_type:
              "person",
            from_canonical_name:
              "Тестова Особа",
            from_status:
              "active",
            from_metadata: {},
            to_id:
              organizationId,
            to_entity_type:
              "organization",
            to_canonical_name:
              "ТОВ ТЕСТ",
            to_status:
              "active",
            to_metadata: {
              source: "edr",
              edrpou:
                "12345678",
            },
          },
        ],
      });

    assert.equal(
      graph.edges.length,
      1,
    );

    const edge =
      graph.edges[0];

    assert.equal(
      edge.type,
      "edr_founder_of",
    );

    assert.equal(
      edge.label,
      "Засновник (ЄДР)",
    );

    assert.equal(
      edge.verification_status,
      "manual_review",
    );

    assert.equal(
      edge.metadata.source,
      "edr",
    );

    assert.equal(
      edge.metadata.review_required,
      true,
    );

    assert.equal(
      edge.metadata.observation_ids,
      undefined,
    );

    assert.equal(
      edge.metadata.snapshot_ids,
      undefined,
    );

    assert.equal(
      graph.nodes[1].metadata.source,
      "edr",
    );
  },
);


test(
  "loadSubjectGraph includes timeless EDR relations when no declaration year exists",
  async () => {
    const subjectId =
      "00000000-0000-4000-8000-000000000001";

    const organizationId =
      "00000000-0000-5000-8000-000000000002";

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
            "FROM subjects s",
          )
        ) {
          return [
            {
              subject_id:
                subjectId,
              entity_id:
                subjectId,
              full_name:
                "Тестова Особа",
              organization:
                null,
              position:
                null,
              city:
                null,
            },
          ];
        }

        if (
          text.includes(
            "WITH direct AS",
          )
        ) {
          return [
            {
              relation_id:
                "00000000-0000-5000-8000-000000000003",
              relation_type:
                "edr_founder_of",
              valid_from: null,
              valid_to: null,
              confidence: 70,
              verification_status:
                "manual_review",
              relation_metadata: {
                source: "edr",
                review_required:
                  true,
              },
              from_id:
                subjectId,
              from_entity_type:
                "person",
              from_canonical_name:
                "Тестова Особа",
              from_status:
                "active",
              from_metadata: {},
              to_id:
                organizationId,
              to_entity_type:
                "organization",
              to_canonical_name:
                "ТОВ ТЕСТ",
              to_status:
                "active",
              to_metadata: {
                source: "edr",
                edrpou:
                  "12345678",
              },
            },
          ];
        }

        if (
          text.includes(
            "SELECT DISTINCT",
          )
        ) {
          return [];
        }

        return [];
      };

    const graph =
      await loadSubjectGraph(
        subjectId,
        { sql },
      );

    assert.equal(
      graph.year,
      null,
    );

    assert.deepEqual(
      graph.available_years,
      [],
    );

    assert.equal(
      graph.edges.length,
      1,
    );

    assert.equal(
      graph.edges[0].type,
      "edr_founder_of",
    );

    assert.equal(
      calls.length,
      3,
    );

    assert.ok(
      calls[2].text.includes(
        "r.valid_from IS NULL",
      ),
    );
  },
);
