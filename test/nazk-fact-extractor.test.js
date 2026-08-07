import test from "node:test";
import assert from "node:assert/strict";

import {
  extractNazkFacts,
  parseDeclaredNumber,
} from "../src/nazk-fact-extractor.js";

const payload = {
  declaration_year: 2025,

  data: {
    step_1: {
      data: {
        firstname: "Антон",
        lastname: "Савченко",
        middlename: "Віталійович",
        workPlace:
          "Організація",
        workPost:
          "Головний спеціаліст",
      },
    },

    step_2: {
      data: [
        {
          id: "family-1",
          firstname: "Ім'я",
          lastname: "Прізвище",
          subjectRelation:
            "член сім'ї",
          taxNumber:
            "SHOULD_NOT_LEAK",
        },
      ],
    },

    step_3: {
      data: [
        {
          iteration: "realty-1",
          person: "family-1",
          objectType: "Квартира",
          city: "Київ",
          totalArea: "50,5",

          rights: [
            {
              rightBelongs:
                "family-1",
              ownershipType:
                "Власність",
              "percent-ownership":
                "100",
            },

            {
              rightBelongs: "j",
              ownershipType:
                "Спільна власність",
              ua_firstname: "Іван",
              ua_lastname: "Іваненко",
              ua_taxNumber:
                "SHOULD_NOT_LEAK",
            },
          ],
        },
      ],
    },

    step_6: {
      data: [
        {
          iteration: "vehicle-1",
          person: "1",
          objectType:
            "Автомобіль",
          brand: "Toyota",
          model: "Camry",
          graduationYear:
            "2020",
        },
      ],
    },

    step_11: {
      data: [
        {
          iteration: "income-1",
          person: "1",
          objectType:
            "Заробітна плата",
          sizeIncome:
            "100 000",
          source_ua_company_name:
            "Організація",
        },
      ],
    },

    step_12: {
      data: [
        {
          iteration: "cash-1",
          person: "1",
          objectType:
            "Готівкові кошти",
          sizeAssets:
            "250000",
          assetsCurrency:
            "UAH",
        },
      ],
    },
  },
};

test("parses Ukrainian decimal", () => {
  assert.equal(
    parseDeclaredNumber(
      "33,34",
    ),
    33.34,
  );
});

test("extracts six fact categories", () => {
  const facts =
    extractNazkFacts(
      payload,
      {
        documentGuid:
          "doc-guid",
      },
    );

  assert.equal(
    facts.length,
    6,
  );

  assert.deepEqual(
    facts.map(
      (fact) =>
        fact.factType,
    ),
    [
      "employment",
      "family_member",
      "real_estate",
      "vehicle",
      "income",
      "cash_asset",
    ],
  );
});

test("maps family owner correctly", () => {
  const facts =
    extractNazkFacts(
      payload,
      {
        documentGuid:
          "doc-guid",
      },
    );

  const realty =
    facts.find(
      (fact) =>
        fact.factType ===
        "real_estate",
    );

  assert.equal(
    realty.valueJson
      .person.role,
    "family",
  );

  assert.equal(
    realty.valueNumber,
    50.5,
  );
});

test("does not copy tax numbers into facts", () => {
  const facts =
    extractNazkFacts(
      payload,
      {
        documentGuid:
          "doc-guid",
      },
    );

  const json =
    JSON.stringify(facts);

  assert.equal(
    json.includes(
      "SHOULD_NOT_LEAK",
    ),
    false,
  );

  assert.equal(
    json.includes(
      "taxNumber",
    ),
    false,
  );
});
