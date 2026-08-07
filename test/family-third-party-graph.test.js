import test from "node:test";
import assert from "node:assert/strict";

import {
  extractThirdPartyRightIdentity,
} from "../src/nazk-fact-extractor.js";

import {
  buildFamilyThirdPartyPlan,
} from "../src/family-third-party-graph.js";

test(
  "extracts third-party organization safely",
  () => {
    const identity =
      extractThirdPartyRightIdentity({
        ua_company_name:
          "Example LLC",

        ua_company_code:
          "03539053",

        ua_taxNumber:
          "SHOULD_NOT_LEAK",
      });

    assert.equal(
      identity.kind,
      "organization",
    );

    assert.equal(
      identity.edrpou,
      "03539053",
    );

    assert.equal(
      JSON.stringify(identity)
        .includes(
          "SHOULD_NOT_LEAK",
        ),
      false,
    );
  },
);

test(
  "extracts third-party person safely",
  () => {
    const identity =
      extractThirdPartyRightIdentity({
        ua_lastname:
          "Іваненко",

        ua_firstname:
          "Іван",

        ua_middlename:
          "Іванович",

        taxNumber:
          "SECRET",
      });

    assert.equal(
      identity.kind,
      "person",
    );

    assert.equal(
      identity.name,
      "Іваненко Іван Іванович",
    );

    assert.equal(
      JSON.stringify(identity)
        .includes("SECRET"),
      false,
    );
  },
);

test(
  "family member becomes observation node",
  () => {
    const plan =
      buildFamilyThirdPartyPlan([
        {
          id: "family-1",

          subject_id:
            "subject-1",

          declaration_year:
            2025,

          source_document_id:
            "document-1",

          fact_type:
            "family_member",

          value_json: {
            name:
              "Іваненко Іван Іванович",

            relation:
              "чоловік",

            person_ref:
              "123",
          },
        },
      ]);

    assert.equal(
      plan.stats.familyRelations,
      1,
    );

    assert.equal(
      plan.stats
        .personObservationNodes,
      1,
    );

    assert.equal(
      plan.nodes[0].entityType,
      "person_observation",
    );
  },
);

test(
  "third-party company with EDRPOU becomes organization",
  () => {
    const plan =
      buildFamilyThirdPartyPlan([
        {
          id: "asset-1",

          subject_id:
            "subject-1",

          declaration_year:
            2025,

          source_document_id:
            "document-1",

          fact_type:
            "real_estate",

          value_text:
            "Квартира",

          value_number: 60,

          value_json: {
            object_type:
              "Квартира",

            country:
              "Україна",

            city:
              "Київ",

            total_area: 60,

            acquisition_date:
              "01.01.2020",

            rights: [
              {
                actor: {
                  role:
                    "third_party",
                },

                third_party_name:
                  "Example LLC",

                third_party_kind:
                  "organization",

                third_party_edrpou:
                  "03539053",

                ownership_type:
                  "Власність",
              },
            ],
          },
        },
      ]);

    assert.equal(
      plan.stats
        .stableOrganizationNodes,
      1,
    );

    assert.equal(
      plan.stats
        .thirdPartyRelations,
      1,
    );
  },
);

test(
  "same unresolved person in same declaration reuses observation node",
  () => {
    const name =
      "Іваненко Іван Іванович";

    const plan =
      buildFamilyThirdPartyPlan([
        {
          id: "family-1",

          subject_id:
            "subject-1",

          declaration_year:
            2025,

          source_document_id:
            "document-1",

          fact_type:
            "family_member",

          value_json: {
            name,
            relation:
              "чоловік",
          },
        },

        {
          id: "asset-1",

          subject_id:
            "subject-1",

          declaration_year:
            2025,

          source_document_id:
            "document-1",

          fact_type:
            "real_estate",

          value_text:
            "Квартира",

          value_number: 60,

          value_json: {
            object_type:
              "Квартира",

            country:
              "Україна",

            city:
              "Київ",

            total_area: 60,

            acquisition_date:
              "01.01.2020",

            rights: [
              {
                actor: {
                  role:
                    "third_party",
                },

                third_party_name:
                  name,

                third_party_kind:
                  "person",

                ownership_type:
                  "Власність",
              },
            ],
          },
        },
      ]);

    assert.equal(
      plan.stats
        .personObservationNodes,
      1,
    );

    assert.equal(
      plan.personObservations
        .length,
      1,
    );

    assert.equal(
      plan.personObservations[0]
        .contexts.length,
      2,
    );
  },
);
