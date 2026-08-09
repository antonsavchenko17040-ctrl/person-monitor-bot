import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_MODEL_LIMITATIONS,
  REPORT_MODEL_SCHEMA_VERSION,
  buildDeclarationSection,
  buildIncomeSection,
  buildCashAssetsSection,
  buildRealEstateSection,
  buildVehicleSection,
  buildSubjectReportModel,
  buildSubjectReportModelPayload,
} from "../src/report-model.js";

const SUBJECT = {
  id:
    "00000000-0000-4000-8000-000000000001",

  entity_id:
    "00000000-0000-4000-8000-000000000002",

  full_name:
    "Тестова Особа",

  organization:
    "Тестова організація",

  position:
    "Тестова посада",

  city:
    "Київ",
};

test(
  "report model exports canonical V1 builders",
  () => {
    assert.equal(
      REPORT_MODEL_SCHEMA_VERSION,
      "report-model-v1",
    );

    assert.ok(
      Array.isArray(
        REPORT_MODEL_LIMITATIONS,
      ),
    );

    assert.equal(
      typeof buildSubjectReportModelPayload,
      "function",
    );

    assert.equal(
      typeof buildSubjectReportModel,
      "function",
    );
  },
);

test(
  "empty report model keeps stable sections and null semantics",
  () => {
    const report =
      buildSubjectReportModelPayload({
        subject: SUBJECT,

        generatedAt:
          "2026-08-09T20:00:00.000Z",
      });

    assert.equal(
      report.schema_version,
      "report-model-v1",
    );

    assert.equal(
      report.generated_at,
      "2026-08-09T20:00:00.000Z",
    );

    assert.deepEqual(
      report.subject,
      {
        subject_id:
          SUBJECT.id,

        entity_id:
          SUBJECT.entity_id,

        full_name:
          SUBJECT.full_name,

        organization:
          SUBJECT.organization,

        position:
          SUBJECT.position,

        city:
          SUBJECT.city,

        status: null,
      },
    );

    assert.equal(
      report.meta.report_id,
      null,
    );

    assert.deepEqual(
      report.meta.available_years,
      [],
    );

    assert.equal(
      report.identity.resolution_status,
      null,
    );

    assert.equal(
      report.identity.hard_match,
      null,
    );

    assert.equal(
      report.mentions.total,
      null,
    );

    assert.deepEqual(
      report.mentions.items,
      [],
    );

    assert.deepEqual(
      report.analytics,
      {
        metrics: [],
        transitions: [],
        findings: [],
      },
    );

    assert.deepEqual(
      report.methodology.limitations,
      REPORT_MODEL_LIMITATIONS,
    );
  },
);

test(
  "report model loader uses injected subject loader",
  async () => {
    let requestedId = null;

    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          generatedAt:
            new Date(
              "2026-08-09T21:00:00.000Z",
            ),

          subjectLoader:
            async (subjectId) => {
              requestedId =
                subjectId;

              return SUBJECT;
            },

          declarationYearsLoader:
            async () => [],
        },
      );

    assert.equal(
      requestedId,
      SUBJECT.id,
    );

    assert.equal(
      report.subject.subject_id,
      SUBJECT.id,
    );

    assert.equal(
      report.subject.entity_id,
      SUBJECT.entity_id,
    );

    assert.equal(
      report.generated_at,
      "2026-08-09T21:00:00.000Z",
    );
  },
);

test(
  "report model loader returns null for missing subject",
  async () => {
    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          subjectLoader:
            async () => null,
        },
      );

    assert.equal(
      report,
      null,
    );
  },
);

test(
  "declaration section maps canonical submission",
  () => {
    const section =
      buildDeclarationSection({
        availableYears: [2025],
        contexts: [{
          analytics: {
            yearly: [{
              year: 2025,
              sourceDocumentId: "doc-2",
            }],
          },
          source_documents: [
            { id: "doc-1", url: "https://example.test/1" },
            { id: "doc-2", url: "https://example.test/2" },
          ],
          facts: [
            {
              id: "f1",
              fact_type: "declaration_submission",
              source_document_id: "doc-1",
              value_json: {
                declaration_year: 2025,
                document_guid: "guid-1",
                registry: "annual",
                published_at: "2026-03-01T10:00:00.000Z",
              },
            },
            {
              id: "f2",
              fact_type: "declaration_submission",
              source_document_id: "doc-2",
              value_json: {
                declaration_year: 2025,
                document_guid: "guid-2",
                registry: "annual",
                published_at: "2026-03-20T10:00:00.000Z",
              },
            },
          ],
        }],
      });

    assert.deepEqual(
      section.available_years,
      [2025],
    );

    assert.equal(
      section.items.length,
      2,
    );

    const canonical =
      section.items.find(
        (item) => item.canonical,
      );

    assert.equal(
      canonical?.document_guid,
      "guid-2",
    );

    assert.equal(
      canonical?.registry,
      "annual",
    );

    assert.equal(
      canonical?.source_url,
      "https://example.test/2",
    );
  },
);

test(
  "report model loader populates declaration years and period",
  async () => {
    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          subjectLoader:
            async () => SUBJECT,

          declarationYearsLoader:
            async () => [2025, 2024],

          employmentContextLoader:
            async () => null,

          incomeDetailContextLoader:
            async () => null,

          cashContextLoader:
            async (_entityId, year) => ({
              detected_years: [
                year,
              ],

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
                id:
                  `cash-${year}`,

                fact_type:
                  "cash_asset",

                source_document_id:
                  `doc-${year}`,

                value_number:
                  year === 2025
                    ? 500
                    : 300,

                unit:
                  year === 2025
                    ? "USD (Долар США)"
                    : "USD",

                metadata: {
                  declaration_year:
                    year,
                },

                value_json: {
                  person: {
                    role:
                      "declarant",
                  },

                  asset_type:
                    "Готівкові кошти",

                  amount:
                    year === 2025
                      ? 500
                      : 300,

                  currency:
                    year === 2025
                      ? "USD (Долар США)"
                      : "USD",

                  rights: [{
                    actor: {
                      role:
                        "declarant",
                    },

                    ownership_type:
                      "Власність",

                    share_percent:
                      null,
                  }],
                },
              }],
            }),

          realEstateContextLoader:
            async (_entityId, year) => ({
              detected_years: [
                year,
              ],

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
                id:
                  `property-${year}`,

                fact_type:
                  "real_estate",

                source_document_id:
                  `doc-${year}`,

                value_number:
                  year === 2025
                    ? 120.5
                    : 80,

                unit:
                  "m2",

                metadata: {
                  declaration_year:
                    year,

                  item_ref:
                    `property-ref-${year}`,
                },

                value_json: {
                  person:
                    null,

                  object_type:
                    "Квартира",

                  total_area:
                    year === 2025
                      ? 120.5
                      : 80,

                  country:
                    "Україна",

                  city:
                    "Київ",

                  acquisition_date:
                    "01.01.2020",

                  rights: [{
                    actor: {
                      role:
                        "declarant",
                    },

                    ownership_type:
                      "Власність",
                  }],
                },
              }],
            }),

          vehicleContextLoader:
            async (_entityId, year) => ({
              detected_years: [
                year,
              ],

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
                id:
                  `vehicle-${year}`,

                fact_type:
                  "vehicle",

                source_document_id:
                  `doc-${year}`,

                metadata: {
                  declaration_year:
                    year,

                  item_ref:
                    `vehicle-ref-${year}`,
                },

                value_json: {
                  person:
                    null,

                  object_type:
                    "Автомобіль легковий",

                  brand:
                    "TEST BRAND",

                  model:
                    year === 2025
                      ? "MODEL A"
                      : "MODEL B",

                  production_year:
                    year === 2025
                      ? 2020
                      : 2019,

                  acquisition_date:
                    "01.01.2020",

                  cost:
                    500000,

                  rights: [{
                    actor: {
                      role:
                        "declarant",
                    },

                    ownership_type:
                      "Власність",
                  }],
                },
              }],
            }),

          multiYearIncomeAnalyticsContextLoader:
            async (_entityId, years) => ({
              source_documents:
                years.map(
                  (year) => ({
                    id: `doc-${year}`,
                    url: `https://example.test/${year}`,
                  }),
                ),

              analytics: {
                yearly:
                  years.map(
                    (year) => ({
                      year,
                      sourceDocumentId:
                        `doc-${year}`,
                      incomeDeclarantUah:
                        year === 2025
                          ? 250
                          : 100,
                      incomeHouseholdUah:
                        year === 2025
                          ? 400
                          : 160,
                    }),
                  ),
              },
            }),

          declarationContextLoader:
            async (_entityId, year) => ({
              analytics: {
                yearly: [{
                  year,
                  sourceDocumentId: `doc-${year}`,
                }],
              },
              source_documents: [{
                id: `doc-${year}`,
                url: `https://example.test/${year}`,
              }],
              facts: [{
                id: `f-${year}`,
                fact_type: "declaration_submission",
                source_document_id: `doc-${year}`,
                value_json: {
                  declaration_year: year,
                  document_guid: `guid-${year}`,
                  registry: "annual",
                },
              }],
            }),
        },
      );

    assert.deepEqual(
      report.declarations.available_years,
      [2025, 2024],
    );

    assert.equal(
      report.declarations.items.length,
      2,
    );

    assert.deepEqual(
      report.meta.period,
      {
        from_year: 2024,
        to_year: 2025,
      },
    );

    assert.deepEqual(
      report.income.yearly.map(
        (item) => item.year,
      ),
      [2025, 2024],
    );

    assert.equal(
      report.income.yearly[0]
        .family_uah,
      150,
    );

    assert.deepEqual(
      report.cash_assets.yearly.map(
        (item) =>
          item.year,
      ),
      [2025, 2024],
    );

    assert.deepEqual(
      report.cash_assets.yearly[0]
        .declarant_by_currency,
      {
        USD:
          500,
      },
    );

    assert.deepEqual(
      report.cash_assets.yearly[0]
        .household_by_currency,
      {
        USD:
          500,
      },
    );

    assert.equal(
      report.cash_assets.yearly[0]
        .items[0]
        .currency,
      "USD",
    );

    assert.equal(
      report.cash_assets.yearly[0]
        .items[0]
        .currency_raw,
      "USD (Долар США)",
    );

    assert.deepEqual(
      report.real_estate.yearly.map(
        (item) =>
          item.year,
      ),
      [2025, 2024],
    );

    assert.equal(
      report.real_estate.yearly[0]
        .items.length,
      1,
    );

    assert.equal(
      report.real_estate.yearly[0]
        .items[0]
        .area,
      120.5,
    );

    assert.equal(
      report.real_estate.yearly[0]
        .items[0]
        .tracking_identity
        .source_item_ref,
      "property-ref-2025",
    );

    assert.equal(
      report.real_estate.yearly[0]
        .items[0]
        .owner_role,
      null,
    );

    assert.equal(
      report.real_estate.yearly[0]
        .items[0]
        .rights[0]
        .role,
      "declarant",
    );

    assert.deepEqual(
      report.vehicles.yearly.map(
        (item) =>
          item.year,
      ),
      [2025, 2024],
    );

    assert.equal(
      report.vehicles.yearly[0]
        .items.length,
      1,
    );

    assert.equal(
      report.vehicles.yearly[0]
        .items[0]
        .brand,
      "TEST BRAND",
    );

    assert.equal(
      report.vehicles.yearly[0]
        .items[0]
        .model,
      "MODEL A",
    );

    assert.equal(
      report.vehicles.yearly[0]
        .items[0]
        .tracking_identity
        .source_item_ref,
      "vehicle-ref-2025",
    );

    assert.equal(
      report.vehicles.yearly[0]
        .items[0]
        .owner_role,
      null,
    );

    assert.equal(
      report.vehicles.yearly[0]
        .items[0]
        .rights[0]
        .role,
      "declarant",
    );
  },
);

test(
  "income section maps canonical UAH aggregates",
  () => {
    const income =
      buildIncomeSection({
        context: {
          source_documents: [
            {
              id: "doc-2024",
              url:
                "https://example.test/2024",
            },
            {
              id: "doc-2025",
              url:
                "https://example.test/2025",
            },
          ],

          analytics: {
            yearly: [
              {
                year: 2024,
                sourceDocumentId:
                  "doc-2024",
                incomeDeclarantUah:
                  100,
                incomeHouseholdUah:
                  160,
              },
              {
                year: 2025,
                sourceDocumentId:
                  "doc-2025",
                incomeDeclarantUah:
                  250,
                incomeHouseholdUah:
                  400,
              },
            ],
          },
        },
      });

    assert.deepEqual(
      income.yearly.map(
        (item) => item.year,
      ),
      [2025, 2024],
    );

    assert.equal(
      income.yearly[0]
        .declarant_uah,
      250,
    );

    assert.equal(
      income.yearly[0]
        .family_uah,
      150,
    );

    assert.equal(
      income.yearly[0]
        .household_uah,
      400,
    );

    assert.equal(
      income.yearly[0]
        .statement_type,
      "calculation",
    );

    assert.equal(
      income.yearly[0]
        .evidence[0].url,
      "https://example.test/2025",
    );

    assert.deepEqual(
      income.sources,
      [],
    );
  },
);

test(
  "report model uses single-year income loader for one declaration year",
  async () => {
    let requestedYear = null;

    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          subjectLoader:
            async () => SUBJECT,

          declarationYearsLoader:
            async () => [2025],

          declarationContextLoader:
            async (_entityId, year) => ({
              analytics: {
                yearly: [{
                  year,
                  sourceDocumentId:
                    `doc-${year}`,
                }],
              },

              source_documents: [{
                id: `doc-${year}`,
                url:
                  `https://example.test/${year}`,
              }],

              facts: [],
            }),

          cashContextLoader:
            async () => null,

          realEstateContextLoader:
            async () => null,

          vehicleContextLoader:
            async () => null,

          employmentContextLoader:
            async () => null,

          incomeDetailContextLoader:
            async (_entityId, year) => ({
              detected_years: [
                year,
              ],

              source_documents: [{
                id:
                  `doc-${year}`,

                url:
                  `https://example.test/${year}`,
              }],

              facts: [{
                id:
                  `income-${year}`,

                fact_type:
                  "income",

                source_document_id:
                  `doc-${year}`,

                value_number:
                  100,

                unit:
                  "UAH",

                metadata: {
                  declaration_year:
                    year,
                },

                value_json: {
                  person: {
                    role:
                      "declarant",

                    name:
                      "Тестова Особа",
                  },

                  income_type:
                    "Заробітна плата",

                  amount:
                    100,

                  source:
                    "Тестова організація",

                  source_details: {
                    source_type:
                      "organization",

                    company_name:
                      "Тестова організація",

                    edrpou:
                      "12345678",

                    tax_number:
                      "MUST_NOT_LEAK",
                  },
                },
              }],
            }),

          incomeAnalyticsContextLoader:
            async (_entityId, year) => {
              requestedYear = year;

              return {
                source_documents: [{
                  id: `doc-${year}`,
                  url:
                    `https://example.test/${year}`,
                }],

                analytics: {
                  yearly: [{
                    year,
                    sourceDocumentId:
                      `doc-${year}`,
                    incomeDeclarantUah:
                      100,
                    incomeHouseholdUah:
                      150,
                  }],
                },
              };
            },

          multiYearIncomeAnalyticsContextLoader:
            async () => {
              throw new Error(
                "multi-year loader must not be called",
              );
            },
        },
      );

    assert.equal(
      requestedYear,
      2025,
    );

    assert.equal(
      report.income.yearly.length,
      1,
    );

    assert.equal(
      report.income.yearly[0]
        .declarant_uah,
      100,
    );

    assert.equal(
      report.income.yearly[0]
        .family_uah,
      50,
    );

    assert.equal(
      report.income.yearly[0]
        .household_uah,
      150,
    );

    assert.equal(
      report.income.sources.length,
      1,
    );

    assert.equal(
      report.income.sources[0]
        .recipient_role,
      "declarant",
    );

    assert.equal(
      report.income.sources[0]
        .income_type,
      "Заробітна плата",
    );

    assert.equal(
      report.income.sources[0]
        .amount,
      100,
    );

    assert.equal(
      report.income.sources[0]
        .currency,
      "UAH",
    );

    assert.equal(
      report.income.sources[0]
        .source,
      "Тестова організація",
    );

    assert.equal(
      report.income.sources[0]
        .statement_type,
      "source_fact",
    );

    assert.equal(
      report.income.sources[0]
        .source_details
        .edrpou,
      "12345678",
    );

    assert.equal(
      report.income.sources[0]
        .source_details
        .tax_number,
      undefined,
    );
  },
);

test(
  "income sources are not merged by source name alone",
  () => {
    const income =
      buildIncomeSection({
        detailContexts: [{
          detected_years: [
            2025,
          ],

          facts: [
            {
              id: "income-person",
              fact_type: "income",
              source_document_id:
                "doc-2025",
              value_number: 100,
              unit: "UAH",
              value_json: {
                person: {
                  role: "declarant",
                },
                income_type:
                  "Інше",
                source:
                  "Однакова назва",
                source_details: {
                  source_type:
                    "person",
                  person_name:
                    "Однакова назва",
                },
              },
            },
            {
              id: "income-organization",
              fact_type: "income",
              source_document_id:
                "doc-2025",
              value_number: 200,
              unit: "UAH",
              value_json: {
                person: {
                  role: "declarant",
                },
                income_type:
                  "Інше",
                source:
                  "Однакова назва",
                source_details: {
                  source_type:
                    "organization",
                  company_name:
                    "Однакова назва",
                },
              },
            },
          ],
        }],
      });

    assert.equal(
      income.sources.length,
      2,
    );

    assert.deepEqual(
      income.sources
        .map(
          (item) =>
            item.source_details
              .source_type,
        )
        .sort(),
      [
        "organization",
        "person",
      ],
    );
  },
);

test(
  "cash assets count joint ownership once without inventing shares",
  () => {
    const cash =
      buildCashAssetsSection({
        contexts: [{
          detected_years:
            [2020],

          analytics: {
            yearly: [{
              year:
                2020,

              sourceDocumentId:
                "doc-2020",
            }],
          },

          source_documents: [{
            id:
              "doc-2020",

            url:
              "https://example.test/2020",
          }],

          facts: [
            {
              id:
                "joint-usd",

              fact_type:
                "cash_asset",

              source_document_id:
                "doc-2020",

              value_number:
                615000,

              unit:
                "USD",

              metadata: {
                declaration_year:
                  2020,
              },

              value_json: {
                person:
                  null,

                asset_type:
                  "Готівкові кошти",

                amount:
                  615000,

                currency:
                  "USD",

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Тестовий Декларант",
                    },

                    ownership_type:
                      "Спільна сумісна власність",

                    share_percent:
                      null,
                  },
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Тестова Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Спільна сумісна власність",

                    share_percent:
                      null,
                  },
                ],
              },
            },

            {
              id:
                "family-eur",

              fact_type:
                "cash_asset",

              source_document_id:
                "doc-2020",

              value_number:
                15032,

              unit:
                "EUR (Євро)",

              metadata: {
                declaration_year:
                  2020,
              },

              value_json: {
                person: {
                  role:
                    "family",

                  name:
                    "Тестова Дружина",

                  relation:
                    "дружина",
                },

                asset_type:
                  "Кошти на рахунках",

                amount:
                  15032,

                currency:
                  "EUR (Євро)",

                rights: [{
                  actor: {
                    role:
                      "family",

                    name:
                      "Тестова Дружина",

                    relation:
                      "дружина",
                  },

                  ownership_type:
                    "Власність",

                  share_percent:
                    null,
                }],
              },
            },
          ],
        }],
      });

    assert.equal(
      cash.yearly.length,
      1,
    );

    assert.deepEqual(
      cash.yearly[0]
        .declarant_by_currency,
      {
        USD:
          615000,
      },
    );

    assert.deepEqual(
      cash.yearly[0]
        .household_by_currency,
      {
        USD:
          615000,

        EUR:
          15032,
      },
    );

    assert.equal(
      cash.yearly[0]
        .items.length,
      2,
    );

    const joint =
      cash.yearly[0]
        .items
        .find(
          (item) =>
            item.amount ===
            615000,
        );

    assert.equal(
      joint?.owner_role,
      null,
    );

    assert.equal(
      joint?.rights.length,
      2,
    );

    assert.equal(
      joint?.rights[0]
        .share_percent,
      null,
    );

    assert.equal(
      joint?.currency,
      "USD",
    );

    assert.equal(
      joint?.currency_raw,
      "USD",
    );

    const euro =
      cash.yearly[0]
        .items
        .find(
          (item) =>
            item.amount ===
            15032,
        );

    assert.equal(
      euro?.currency,
      "EUR",
    );

    assert.equal(
      euro?.currency_raw,
      "EUR (Євро)",
    );
  },
);

test(
  "real estate keeps colliding signatures as separate source facts",
  () => {
    const section =
      buildRealEstateSection({
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

          facts: [
            {
              id:
                "property-a",

              fact_type:
                "real_estate",

              source_document_id:
                "doc-2025",

              value_number:
                91.9,

              unit:
                "m2",

              metadata: {
                declaration_year:
                  2025,

                item_ref:
                  "item-a",
              },

              value_json: {
                person:
                  null,

                object_type:
                  "Квартира",

                total_area:
                  91.9,

                country:
                  "Україна",

                city:
                  "Київ",

                acquisition_date:
                  "20.11.2014",

                cost:
                  null,

                rights: [{
                  actor: {
                    role:
                      "declarant",
                  },

                  ownership_type:
                    "Власність",

                  share_percent:
                    50,
                }],
              },
            },

            {
              id:
                "property-b",

              fact_type:
                "real_estate",

              source_document_id:
                "doc-2025",

              value_number:
                91.9,

              unit:
                "m2",

              metadata: {
                declaration_year:
                  2025,

                item_ref:
                  "item-b",
              },

              value_json: {
                person:
                  null,

                object_type:
                  "Квартира",

                total_area:
                  91.9,

                country:
                  "Україна",

                city:
                  "Київ",

                acquisition_date:
                  "20.11.2014",

                cost:
                  null,

                rights: [{
                  actor: {
                    role:
                      "family",

                    relation:
                      "дружина",
                  },

                  ownership_type:
                    "Власність",

                  share_percent:
                    50,
                }],
              },
            },
          ],
        }],
      });

    assert.equal(
      section.yearly.length,
      1,
    );

    assert.equal(
      section.yearly[0]
        .items.length,
      2,
    );

    const refs =
      section.yearly[0]
        .items
        .map(
          (item) =>
            item
              .tracking_identity
              .source_item_ref,
        )
        .sort();

    assert.deepEqual(
      refs,
      [
        "item-a",
        "item-b",
      ],
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .tracking_identity
        .source_system,
      "nazk",
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .cost,
      null,
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .owner_role,
      null,
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .rights.length,
      1,
    );
  },
);

test(
  "vehicles keep source records separate",
  () => {
    const section =
      buildVehicleSection({
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

          facts: [
            {
              fact_type:
                "vehicle",

              source_document_id:
                "doc-2025",

              metadata: {
                declaration_year:
                  2025,

                item_ref:
                  "vehicle-a",
              },

              value_json: {
                person:
                  null,

                object_type:
                  "Автомобіль легковий",

                brand:
                  "LAND ROVER",

                model:
                  "RANGE ROVER",

                production_year:
                  2016,

                acquisition_date:
                  "19.05.2016",

                cost:
                  1000000,

                rights: [{
                  actor: {
                    role:
                      "declarant",
                  },

                  ownership_type:
                    "Власність",
                }],
              },
            },

            {
              fact_type:
                "vehicle",

              source_document_id:
                "doc-2025",

              metadata: {
                declaration_year:
                  2025,

                item_ref:
                  "vehicle-b",
              },

              value_json: {
                person:
                  null,

                object_type:
                  "Автомобіль легковий",

                brand:
                  "LAND ROVER",

                model:
                  "RANGE ROVER",

                production_year:
                  2016,

                acquisition_date:
                  "19.05.2016",

                cost:
                  1100000,

                rights: [{
                  actor: {
                    role:
                      "family",
                  },

                  ownership_type:
                    "Власність",
                }],
              },
            },
          ],
        }],
      });

    assert.equal(
      section.yearly.length,
      1,
    );

    assert.equal(
      section.yearly[0]
        .items.length,
      2,
    );

    const refs =
      section.yearly[0]
        .items
        .map(
          (item) =>
            item
              .tracking_identity
              .source_item_ref,
        )
        .sort();

    assert.deepEqual(
      refs,
      [
        "vehicle-a",
        "vehicle-b",
      ],
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .tracking_identity
        .source_system,
      "nazk",
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .owner_role,
      null,
    );

    assert.equal(
      section.yearly[0]
        .items[0]
        .rights.length,
      1,
    );
  },
);
