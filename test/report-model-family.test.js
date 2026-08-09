import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRelatedPeopleSection,
} from "../src/report-model.js";

test(
  "family observations are not merged across years by name or source ref",
  () => {
    const makeContext =
      (year) => ({
        detected_years:
          [year],

        analytics: {
          yearly: [{
            year,
            sourceDocumentId:
              `doc-${year}`,
          }],
        },

        source_documents: [{
          id:
            `doc-${year}`,
          url:
            `https://example.test/${year}`,
        }],

        facts: [{
          fact_type:
            "family_member",

          source_document_id:
            `doc-${year}`,

          metadata: {
            declaration_year:
              year,
          },

          value_json: {
            name:
              "Тестова Особа",

            relation:
              "дружина",

            person_ref:
              "same-source-ref",
          },
        }],
      });

    const section =
      buildRelatedPeopleSection({
        familyContexts: [
          makeContext(2024),
          makeContext(2025),
        ],
      });

    assert.equal(
      section.items.length,
      2,
    );

    assert.deepEqual(
      section.items.map(
        (item) =>
          item.years[0],
      ),
      [2025, 2024],
    );

    assert.equal(
      section.items[0]
        .entity_id,
      null,
    );

    assert.equal(
      section.items[0]
        .identity_status,
      "source_observation",
    );

    assert.equal(
      section.items[0]
        .review_required,
      true,
    );

    assert.equal(
      section.items[0]
        .source_identity
        .source_person_ref,
      "same-source-ref",
    );
  },
);
