import test from "node:test";
import assert from "node:assert/strict";

import {
  GRAPH_RELATION_LABELS,
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
