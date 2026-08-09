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

          objectType:
            "Готівкові кошти",

          sizeAssets:
            "250000",

          assetsCurrency:
            "UAH",

          rights: [
            {
              rightBelongs:
                "family-1",

              ownershipType:
                "Власність",
            },
          ],
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

test(
  "maps cash owner from rights when person is absent",
  () => {
    const facts =
      extractNazkFacts(
        payload,
        {
          documentGuid:
            "doc-guid",
        },
      );

    const cash =
      facts.find(
        (fact) =>
          fact.factType ===
          "cash_asset",
      );

    assert.equal(
      cash.valueJson
        .person.ref,
      "family-1",
    );

    assert.equal(
      cash.valueJson
        .person.role,
      "family",
    );

    assert.equal(
      cash.valueJson
        .person.name,
      "Прізвище Ім'я",
    );

    assert.equal(
      cash.valueJson
        .rights.length,
      1,
    );

    assert.equal(
      cash.valueJson
        .rights[0]
        .belongs_ref,
      "family-1",
    );

    assert.equal(
      cash.valueJson
        .rights[0]
        .ownership_type,
      "Власність",
    );
  },
);

test(
  "keeps joint cash ownership in rights without inventing one owner",
  () => {
    const jointPayload =
      structuredClone(
        payload
      );

    jointPayload
      .data
      .step_12
      .data = [
        {
          iteration:
            "cash-joint-1",

          objectType:
            "Готівкові кошти",

          sizeAssets:
            "100000",

          assetsCurrency:
            "UAH",

          rights: [
            {
              rightBelongs:
                "1",

              ownershipType:
                "Спільна сумісна власність",
            },

            {
              rightBelongs:
                "family-1",

              ownershipType:
                "Спільна сумісна власність",
            },
          ],
        },
      ];

    const facts =
      extractNazkFacts(
        jointPayload,
        {
          documentGuid:
            "doc-guid-joint",
        },
      );

    const cash =
      facts.find(
        (fact) =>
          fact.factType ===
          "cash_asset",
      );

    assert.equal(
      cash.valueJson.person,
      null,
    );

    assert.equal(
      cash.valueJson
        .rights.length,
      2,
    );

    assert.deepEqual(
      cash.valueJson
        .rights
        .map(
          (right) =>
            right.actor.role
        ),
      [
        "declarant",
        "family",
      ],
    );

    assert.deepEqual(
      cash.valueJson
        .rights
        .map(
          (right) =>
            right.ownership_type
        ),
      [
        "Спільна сумісна власність",
        "Спільна сумісна власність",
      ],
    );
  },
);

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

test(
  "extracts real NACP income owner and nested source schema",
  () => {
    const realIncomePayload = {
      declaration_year: 2024,

      data: {
        step_1: {
          data: {
            firstname: "Володимир",
            lastname: "Зеленський",
            middlename: "Олександрович",
          },
        },

        step_2: {
          data: [
            {
              id: "family-1",
              firstname: "Олена",
              lastname: "Зеленська",
              subjectRelation:
                "дружина",
            },
          ],
        },

        step_11: {
          data: [
            {
              iteration:
                "income-declarant",

              objectType:
                "Заробітна плата",

              sizeIncome:
                "336000",

              person_who_care: [
                {
                  person: "1",
                },
              ],

              sources: [
                {
                  incomeSource: "j",

                  source_ua_company_code:
                    "00037256",

                  source_ua_company_name:
                    "ДЕРЖАВНЕ УПРАВЛІННЯ СПРАВАМИ",
                },
              ],
            },

            {
              iteration:
                "income-family",

              objectType:
                "Дохід від оренди",

              sizeIncome:
                "100000",

              person_who_care: [
                {
                  person:
                    "family-1",
                },
              ],

              sources: [
                {
                  incomeSource: "j",

                  source_ua_company_code:
                    "12345678",

                  source_ua_company_name:
                    "ТЕСТОВА КОМПАНІЯ",
                },
              ],
            },
          ],
        },
      },
    };

    const facts =
      extractNazkFacts(
        realIncomePayload,
        {
          documentGuid:
            "real-income-doc",
        },
      );

    const incomes =
      facts.filter(
        (fact) =>
          fact.factType ===
          "income",
      );

    assert.equal(
      incomes.length,
      2,
    );

    assert.equal(
      incomes[0].valueJson
        .person.role,
      "declarant",
    );

    assert.equal(
      incomes[0].valueJson
        .person.ref,
      "1",
    );

    assert.equal(
      incomes[0].valueJson
        .source,
      "ДЕРЖАВНЕ УПРАВЛІННЯ СПРАВАМИ",
    );

    assert.equal(
      incomes[0].valueJson
        .source_details
        .source_type,
      "organization",
    );

    assert.equal(
      incomes[0].valueJson
        .source_details
        .company_name,
      "ДЕРЖАВНЕ УПРАВЛІННЯ СПРАВАМИ",
    );

    assert.equal(
      incomes[0].valueJson
        .source_details
        .edrpou,
      "00037256",
    );

    assert.equal(
      incomes[1].valueJson
        .person.role,
      "family",
    );

    assert.equal(
      incomes[1].valueJson
        .person.ref,
      "family-1",
    );
  },
);

test(
  "resolves declarant as income source from incomeSource actor reference",
  () => {
    const payload = {
      declaration_year: 2019,

      data: {
        step_1: {
          data: {
            firstname: "Володимир",
            lastname: "Зеленський",
            middlename: "Олександрович",
          },
        },

        step_11: {
          data: [
            {
              iteration:
                "entrepreneur-income",

              objectType:
                "Дохід від зайняття підприємницькою діяльністю",

              sizeIncome:
                "1053250",

              incomeSource: "1",

              person_who_care: [
                {
                  person: "1",
                },
              ],
            },
          ],
        },
      },
    };

    const facts =
      extractNazkFacts(
        payload,
        {
          documentGuid:
            "self-source-doc",
        },
      );

    const income =
      facts.find(
        (fact) =>
          fact.factType ===
          "income",
      );

    assert.equal(
      income.valueJson
        .person.role,
      "declarant",
    );

    assert.equal(
      income.valueJson
        .source,
      "Зеленський Володимир Олександрович",
    );

    assert.equal(
      income.valueJson
        .source_details
        .source_type,
      "person",
    );

    assert.equal(
      income.valueJson
        .source_details
        .person_name,
      "Зеленський Володимир Олександрович",
    );
  },
);
