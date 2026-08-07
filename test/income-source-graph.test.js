import test from "node:test";
import assert from "node:assert/strict";

import {
  extractIncomeSourceDetails,
} from "../src/nazk-fact-extractor.js";

import {
  buildIncomeSourcePlan,
} from "../src/income-source-graph.js";

test(
  "extracts organization source by EDRPOU",
  () => {
    const details =
      extractIncomeSourceDetails({
        source_ua_company_name:
          "НАЗК",

        source_ua_company_code:
          "40381452",

        source_ua_taxNumber:
          "SHOULD_NOT_LEAK",
      });

    assert.equal(
      details.source_type,
      "organization",
    );

    assert.equal(
      details.edrpou,
      "40381452",
    );

    assert.equal(
      JSON.stringify(details)
        .includes(
          "SHOULD_NOT_LEAK",
        ),
      false,
    );
  },
);

test(
  "extracts person source without sensitive fields",
  () => {
    const details =
      extractIncomeSourceDetails({
        source_ua_lastname:
          "Іваненко",

        source_ua_firstname:
          "Іван",

        source_ua_middlename:
          "Іванович",

        source_ua_taxNumber:
          "SECRET",

        source_ua_birthday:
          "SECRET",
      });

    assert.equal(
      details.source_type,
      "person",
    );

    assert.equal(
      details.person_name,
      "Іваненко Іван Іванович",
    );

    assert.equal(
      JSON.stringify(details)
        .includes("SECRET"),
      false,
    );
  },
);

test(
  "aggregates multiple incomes from same organization",
  () => {
    const common = {
      subject_id:
        "subject-1",

      declaration_year:
        2025,

      source_document_id:
        "document-1",

      unit: "UAH",

      value_json: {
        income_type:
          "Заробітна плата",

        source_details: {
          source_type:
            "organization",

          company_name:
            "НАЗК",

          edrpou:
            "40381452",
        },
      },
    };

    const plan =
      buildIncomeSourcePlan([
        {
          ...common,
          id: "fact-1",
          value_number:
            100000,
          value_text:
            "Заробітна плата",
        },

        {
          ...common,
          id: "fact-2",
          value_number:
            50000,
          value_text:
            "Інший дохід",
        },
      ]);

    assert.equal(
      plan.nodes.length,
      1,
    );

    assert.equal(
      plan.relations.length,
      1,
    );

    assert.equal(
      plan.relations[0]
        .metadata
        .total_income_uah,
      150000,
    );

    assert.equal(
      plan.relations[0]
        .metadata
        .evidence_count,
      2,
    );
  },
);

test(
  "person source becomes observation not entity node",
  () => {
    const plan =
      buildIncomeSourcePlan([
        {
          id: "fact-1",

          subject_id:
            "subject-1",

          declaration_year:
            2025,

          source_document_id:
            "document-1",

          value_number:
            5000,

          value_text:
            "Подарунок",

          unit: "UAH",

          value_json: {
            source_details: {
              source_type:
                "person",

              person_name:
                "Іваненко Іван Іванович",
            },
          },
        },
      ]);

    assert.equal(
      plan.nodes.length,
      0,
    );

    assert.equal(
      plan.observations.length,
      1,
    );
  },
);

test(
  "foreign organization without EDRPOU is deferred",
  () => {
    const plan =
      buildIncomeSourcePlan([
        {
          id: "fact-1",

          subject_id:
            "subject-1",

          declaration_year:
            2025,

          source_document_id:
            "document-1",

          value_json: {
            source_details: {
              source_type:
                "organization",

              foreign_company_name:
                "Example Ltd",

              foreign_company_code:
                "ABC123",

              edrpou: null,
            },
          },
        },
      ]);

    assert.equal(
      plan.nodes.length,
      0,
    );

    assert.equal(
      plan.stats
        .deferredOrganizationRows,
      1,
    );
  },
);
