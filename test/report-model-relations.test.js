import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRelationsSection,
} from "../src/report-model.js";

test(
  "relations preserve direct and second-hop links",
  () => {
    const section =
      buildRelationsSection({
        contexts: [{
          detected_years:
            [2025],

          analytics: {
            yearly: [{
              year:
                2025,

              sourceDocumentId:
                "doc-2025",
            }],
          },

          source_documents: [{
            id:
              "doc-2025",

            url:
              "https://example.test/2025",
          }],

          relations: [
            {
              id:
                "r1",

              from_entity_id:
                "subject",

              to_entity_id:
                "org",

              relation_type:
                "employed_by",

              relation_scope:
                "direct",

              source_document_id:
                "doc-2025",

              from_entity_type:
                "person",

              from_name:
                "Особа",

              to_entity_type:
                "organization",

              to_name:
                "Організація",
            },

            {
              id:
                "r2",

              from_entity_id:
                "subject",

              to_entity_id:
                "asset",

              relation_type:
                "declared_asset",

              relation_scope:
                "direct",

              source_document_id:
                "doc-2025",

              from_entity_type:
                "person",

              from_name:
                "Особа",

              to_entity_type:
                "vehicle",

              to_name:
                "Автомобіль",
            },

            {
              id:
                "r3",

              from_entity_id:
                "asset",

              to_entity_id:
                "third-party",

              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              source_document_id:
                "doc-2025",

              from_entity_type:
                "vehicle",

              from_name:
                "Автомобіль",

              to_entity_type:
                "person_observation",

              to_name:
                "Третя Особа",
            },
          ],
        }],
      });

    assert.equal(
      section.items.length,
      3,
    );

    assert.equal(
      section.counts
        .third_party_rightsholder,
      1,
    );

    assert.equal(
      section.items.some(
        (item) =>
          item.relation_scope ===
            "second_hop" &&
          item.to_name ===
            "Третя Особа",
      ),
      true,
    );
  },
);
