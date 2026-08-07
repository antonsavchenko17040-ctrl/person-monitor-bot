import test from "node:test";
import assert from "node:assert/strict";

import {
  assetIdentity,
  buildPlanFromRows,
  deterministicUuid,
  normalizeEdrpou,
} from "../src/graph-builder.js";

test(
  "normalizes Ukrainian EDRPOU",
  () => {
    assert.equal(
      normalizeEdrpou(
        "40 381 452",
      ),
      "40381452",
    );

    assert.equal(
      normalizeEdrpou(
        "123",
      ),
      null,
    );
  },
);

test(
  "deterministic graph UUID is stable",
  () => {
    const a =
      deterministicUuid(
        "asset",
        "abc",
      );

    const b =
      deterministicUuid(
        "asset",
        "abc",
      );

    assert.equal(a, b);

    assert.match(
      a,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  },
);

test(
  "same physical property ignores holder difference",
  () => {
    const base = {
      fact_type:
        "real_estate",

      value_text:
        "Квартира",

      value_number:
        60,

      value_json: {
        object_type:
          "Квартира",

        country:
          "Україна",

        city:
          "Київ",

        total_area:
          60,

        acquisition_date:
          "01.01.2020",

        rights: [],
      },
    };

    const left =
      assetIdentity({
        ...base,

        value_json: {
          ...base.value_json,

          person: {
            role:
              "declarant",
          },
        },
      });

    const right =
      assetIdentity({
        ...base,

        value_json: {
          ...base.value_json,

          person: {
            role:
              "family",
          },
        },
      });

    assert.ok(left);
    assert.ok(right);

    assert.equal(
      left.fingerprint,
      right.fingerprint,
    );
  },
);

test(
  "weak property identity is not promoted to graph node",
  () => {
    const identity =
      assetIdentity({
        fact_type:
          "real_estate",

        value_json: {
          object_type:
            "Квартира",

          total_area: 50,

          rights: [],
        },
      });

    assert.equal(
      identity,
      null,
    );
  },
);

test(
  "different vehicle models create different asset fingerprints",
  () => {
    const make =
      (model) =>
        assetIdentity({
          fact_type:
            "vehicle",

          value_json: {
            brand:
              "Toyota",

            model,

            production_year:
              2020,

            acquisition_date:
              "01.01.2021",
          },
        });

    assert.notEqual(
      make("Camry")
        .fingerprint,

      make("Corolla")
        .fingerprint,
    );
  },
);

test(
  "graph plan merges duplicate evidence for same asset",
  () => {
    const sourceDocumentId =
      "00000000-0000-0000-0000-000000000001";

    const subjectId =
      "00000000-0000-0000-0000-000000000002";

    const property = {
      fact_type:
        "real_estate",

      value_text:
        "Квартира",

      value_number:
        60,

      value_json: {
        object_type:
          "Квартира",

        country:
          "Україна",

        city:
          "Київ",

        total_area:
          60,

        acquisition_date:
          "01.01.2020",

        person: {
          role:
            "declarant",
        },

        rights: [],
      },
    };

    const plan =
      buildPlanFromRows([
        {
          id:
            "00000000-0000-0000-0000-000000000011",

          subject_id:
            subjectId,

          source_document_id:
            sourceDocumentId,

          year: 2025,

          ...property,
        },

        {
          id:
            "00000000-0000-0000-0000-000000000012",

          subject_id:
            subjectId,

          source_document_id:
            sourceDocumentId,

          year: 2025,

          ...property,

          value_json: {
            ...property.value_json,

            person: {
              role:
                "family",
            },
          },
        },

        {
          id:
            "00000000-0000-0000-0000-000000000013",

          subject_id:
            subjectId,

          source_document_id:
            sourceDocumentId,

          year: 2025,

          fact_type:
            "employment",

          value_json: {
            workplace:
              "НАЗК",

            workplace_edrpou:
              "40381452",

            position:
              "Спеціаліст",
          },
        },
      ]);

    assert.equal(
      plan.nodes.length,
      2,
    );

    assert.equal(
      plan.relations.length,
      2,
    );

    const assetRelation =
      plan.relations.find(
        (relation) =>
          relation.relationType ===
          "declared_asset",
      );

    assert.equal(
      assetRelation
        .metadata
        .evidence_count,
      2,
    );
  },
);
