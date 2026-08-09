import test from "node:test";
import assert from "node:assert/strict";

import {
  buildThirdPartyPeopleSection,
} from "../src/report-model.js";

test(
  "third-party people remain source observations",
  () => {
    const section =
      buildThirdPartyPeopleSection({
        relations: {
          items: [
            {
              relation_id:
                "r-2024",

              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              year:
                2024,

              from_entity_type:
                "vehicle",

              from_name:
                "Автомобіль",

              to_entity_type:
                "person_observation",

              to_name:
                "Тестова Особа",

              metadata: {},

              evidence: [{
                source_document_id:
                  "doc-2024",

                statement_type:
                  "source_fact",
              }],
            },

            {
              relation_id:
                "r-2025",

              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              year:
                2025,

              from_entity_type:
                "vehicle",

              from_name:
                "Автомобіль",

              to_entity_type:
                "person_observation",

              to_name:
                "Тестова Особа",

              metadata: {},

              evidence: [{
                source_document_id:
                  "doc-2025",

                statement_type:
                  "source_fact",
              }],
            },
          ],
        },
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
        .relation_type,
      "third_party_rightsholder",
    );
  },
);
