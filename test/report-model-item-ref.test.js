import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRelatedPeopleSection,
  buildThirdPartyPeopleSection,
} from "../src/report-model.js";


function familyContext({
  name = "Тестова Особа",
  personRef = "person-7",
} = {}) {
  return {
    detected_years: [2025],

    analytics: {
      yearly: [{
        sourceDocumentId:
          "source-document-1",
      }],
    },

    source_documents: [{
      id:
        "source-document-1",

      url:
        "https://example.test/declaration",
    }],

    facts: [{
      fact_type:
        "family_member",

      source_document_id:
        "source-document-1",

      metadata: {
        declaration_year:
          2025,
      },

      value_json: {
        name,

        relation:
          "дружина",

        person_ref:
          personRef,
      },
    }],
  };
}


function thirdPartyRelations({
  name = "Третя Особа",
  relationId = "relation-1",
} = {}) {
  return {
    items: [{
      relation_id:
        relationId,

      relation_type:
        "third_party_rightsholder",

      relation_scope:
        "declaration",

      from_entity_id:
        "subject-1",

      to_entity_id:
        null,

      from_entity_type:
        "subject",

      from_name:
        "Суб’єкт",

      to_entity_type:
        "person_observation",

      to_name:
        name,

      year:
        2025,

      metadata: {
        relation:
          "правовласник",
      },

      evidence: [],
    }],
  };
}


test(
  "family related person exposes stable opaque provenance reference",
  () => {
    const first =
      buildRelatedPeopleSection({
        familyContexts: [
          familyContext({
            name:
              "Перше Відображення",
          }),
        ],
      }).items[0];

    const renamed =
      buildRelatedPeopleSection({
        familyContexts: [
          familyContext({
            name:
              "Змінене Відображення",
          }),
        ],
      }).items[0];

    const differentSourcePerson =
      buildRelatedPeopleSection({
        familyContexts: [
          familyContext({
            personRef:
              "person-8",
          }),
        ],
      }).items[0];

    assert.match(
      first.item_ref,
      /^related-person-ref-v1:[a-f0-9]{64}$/,
    );

    assert.equal(
      renamed.item_ref,
      first.item_ref,
    );

    assert.notEqual(
      differentSourcePerson.item_ref,
      first.item_ref,
    );

    assert.equal(
      first.item_ref.includes(
        "Перше Відображення",
      ),
      false,
    );

    assert.equal(
      first.item_ref.includes(
        "person-7",
      ),
      false,
    );

    assert.equal(
      first.item_ref.includes(
        "source-document-1",
      ),
      false,
    );
  },
);


test(
  "third party related person reference follows canonical relation provenance",
  () => {
    const first =
      buildThirdPartyPeopleSection({
        relations:
          thirdPartyRelations({
            name:
              "Перше Відображення",
          }),
      }).items[0];

    const renamed =
      buildThirdPartyPeopleSection({
        relations:
          thirdPartyRelations({
            name:
              "Змінене Відображення",
          }),
      }).items[0];

    const differentRelation =
      buildThirdPartyPeopleSection({
        relations:
          thirdPartyRelations({
            relationId:
              "relation-2",
          }),
      }).items[0];

    assert.match(
      first.item_ref,
      /^related-person-ref-v1:[a-f0-9]{64}$/,
    );

    assert.equal(
      renamed.item_ref,
      first.item_ref,
    );

    assert.notEqual(
      differentRelation.item_ref,
      first.item_ref,
    );

    assert.equal(
      first.item_ref.includes(
        "Перше Відображення",
      ),
      false,
    );

    assert.equal(
      first.item_ref.includes(
        "relation-1",
      ),
      false,
    );
  },
);
