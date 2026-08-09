import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCareerSection,
} from "../src/report-model.js";

test(
  "career builds adjacent year transitions",
  () => {
    const makeContext =
      (
        year,
        organization,
        position,
      ) => ({
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
            "employment",

          source_document_id:
            `doc-${year}`,

          metadata: {
            declaration_year:
              year,
          },

          value_json: {
            person: {
              role:
                "declarant",
            },

            workplace:
              organization,

            position,
          },
        }],
      });

    const section =
      buildCareerSection({
        contexts: [
          makeContext(
            2024,
            "Організація",
            "Посада А",
          ),
          makeContext(
            2025,
            "ОРГАНІЗАЦІЯ",
            "Посада Б",
          ),
        ],
      });

    assert.deepEqual(
      section.items.map(
        (item) => item.year,
      ),
      [2025, 2024],
    );

    assert.equal(
      section.transitions.length,
      1,
    );

    assert.equal(
      section.transitions[0]
        .organization_changed,
      false,
    );

    assert.equal(
      section.transitions[0]
        .position_changed,
      true,
    );
  },
);
