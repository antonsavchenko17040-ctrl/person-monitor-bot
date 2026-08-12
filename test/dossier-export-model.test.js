import test from "node:test";
import assert from "node:assert/strict";

import {
  DOSSIER_EXPORT_MODEL_VERSION,
  buildDossierExportModel,
} from "../src/dossier-export-model.js";

const SOURCE_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fixture() {
  return {
    dossier_version_id:
      "11111111-1111-4111-8111-111111111111",

    subject_id:
      "22222222-2222-4222-8222-222222222222",

    dossier_status:
      "completed",

    report_schema_version:
      "report-model-v1",

    report_generated_at:
      "2026-08-12T10:00:00.000Z",

    report_payload_hash:
      "deadbeef",

    report_payload_hash_version:
      "canonical-json-sha256-v1",

    created_at:
      "2026-08-12T10:01:00.000Z",

    report: {
      subject: {
        id:
          "22222222-2222-4222-8222-222222222222",

        full_name:
          "Тестовий Суб’єкт",

        position:
          "Посада",

        organization:
          "Організація",

        city:
          "Київ",
      },

      analytical_brief: {
        version:
          "analytical-brief-v1",

        sections: [
          {
            code:
              "overview",

            title:
              "Профіль та декларації",

            source_paths: [
              "subject",
              "identity",
              "unknown_internal",
            ],
          },
        ],
      },

      income: {
        yearly: [
          {
            year:
              2025,

            declarant_uah:
              100000,

            family_uah:
              25000,

            household_uah:
              125000,

            source_document_id:
              SOURCE_ID,

            statement_type:
              "calculation",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "calculation",
              },
            ],
          },
        ],

        sources: [
          {
            year:
              2025,

            recipient_role:
              "declarant",

            recipient_name:
              "Тестовий Суб’єкт",

            income_type:
              "Заробітна плата",

            amount:
              100000,

            currency:
              "UAH",

            source:
              "Організація А",

            source_details: {
              edrpou:
                "12345678",

              internal_ref:
                "hidden-income-ref",
            },

            source_document_id:
              SOURCE_ID,

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,
              },
            ],
          },
        ],
      },

      cash_assets: {
        yearly: [
          {
            year:
              2025,

            declarant_by_currency: {
              UAH:
                200000,
            },

            household_by_currency: {
              UAH:
                250000,

              USD:
                5000,
            },

            items: [
              {
                asset_type:
                  "Готівка",

                amount:
                  200000,

                currency:
                  "UAH",

                owner_role:
                  "declarant",

                owner_name:
                  "Тестовий Суб’єкт",

                source_document_id:
                  SOURCE_ID,

                tracking_identity: {
                  source_item_ref:
                    "hidden-cash-ref",
                },

                evidence: [
                  {
                    source_document_id:
                      SOURCE_ID,
                  },
                ],
              },
            ],

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "calculation",
              },
            ],
          },
        ],
      },

      real_estate: {
        yearly: [
          {
            year:
              2025,

            items: [
              {
                object_type:
                  "Квартира",

                area:
                  75.5,

                area_unit:
                  "м²",

                location: {
                  country:
                    "Україна",

                  city:
                    "Київ",

                  internal_code:
                    "hidden-location-code",
                },

                acquisition_date:
                  "2020-01-01",

                cost:
                  2500000,

                owner_role:
                  "declarant",

                rights: [
                  {
                    right_type:
                      "Власність",

                    percentage:
                      100,

                    internal_id:
                      "hidden-right-id",
                  },
                ],

                tracking_identity: {
                  source_system:
                    "nazk",

                  source_item_ref:
                    "hidden-estate-ref",
                },

                source_document_id:
                  SOURCE_ID,

                evidence: [
                  {
                    source_document_id:
                      SOURCE_ID,
                  },
                ],
              },
            ],

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,
              },
            ],
          },
        ],
      },

      vehicles: {
        yearly: [
          {
            year:
              2025,

            items: [
              {
                object_type:
                  "Автомобіль",

                brand:
                  "TEST",

                model:
                  "MODEL",

                production_year:
                  2022,

                acquisition_date:
                  "2023-05-01",

                cost:
                  900000,

                owner_role:
                  "declarant",

                tracking_identity: {
                  source_system:
                    "nazk",

                  source_item_ref:
                    "hidden-vehicle-ref",
                },

                source_document_id:
                  SOURCE_ID,

                evidence: [
                  {
                    source_document_id:
                      SOURCE_ID,
                  },
                ],
              },
            ],

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,
              },
            ],
          },
        ],
      },

      analytics: {
        metrics: [
          {
            year:
              2025,

            income_declarant_uah:
              100000,

            income_household_uah:
              125000,

            cash_declarant_by_currency: {
              UAH:
                200000,
            },

            cash_household_by_currency: {
              UAH:
                250000,

              USD:
                5000,
            },

            real_estate_items:
              1,

            vehicle_items:
              1,

            relation_count:
              2,

            career: {
              organization:
                "Організація А",

              position:
                "Посада А",
            },

            source_document_id:
              SOURCE_ID,

            statement_type:
              "calculation",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "calculation",
              },
            ],
          },
        ],

        transitions: [
          {
            from_year:
              2024,

            to_year:
              2025,

            year_gap:
              1,

            income_delta_uah:
              50000,

            income_delta_percent:
              100,

            cash_uah_delta:
              150000,

            real_estate_count_delta:
              1,

            vehicle_count_delta:
              0,

            organization_changed:
              true,

            position_changed:
              false,

            internal_transition_ref:
              "hidden-transition-ref",

            statement_type:
              "calculation",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "calculation",
              },
            ],
          },
        ],

        findings: [
          {
            rule_code:
              "PM_CASH_UAH_GROWTH_RATIO_V1",

            domain:
              "financial_dynamics",

            result:
              "review",

            severity:
              "review",

            score:
              88,

            message:
              "Тестовий аналітичний сигнал",

            details: {
              from_year:
                2024,

              to_year:
                2025,

              cash_uah_delta:
                150000,

              current_income_uah:
                100000,

              ratio:
                1.5,

              internal_debug:
                "hidden-analytics-debug",
            },

            statement_type:
              "heuristic_signal",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "heuristic_signal",
              },
            ],
          },
        ],
      },

      mentions: {
        total:
          1,

        items: [
          {
            source_document_id:
              SOURCE_ID,

            provider:
              "google-news",

            source:
              "Example Media",

            title:
              "Тестова згадка",

            snippet:
              "Короткий безпечний фрагмент.",

            url:
              "https://example.test/source",

            published_at:
              "2026-08-11T10:00:00.000Z",

            first_seen_at:
              "2026-08-12T09:00:00.000Z",

            match_score:
              92,

            match_level:
              "confirmed",

            reasons: [
              "name_context_match",
            ],

            query:
              "secret search query",

            search_query:
              "secret search query 2",

            full_text:
              "full article body must never export",

            provider_article_body:
              "raw provider article body",
          },
        ],
      },

      career: {
        items: [
          {
            year:
              2025,

            organization:
              "Організація А",

            position:
              "Посада А",

            source_document_id:
              SOURCE_ID,

            statement_type:
              "source_fact",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "source_fact",
              },
            ],
          },
        ],

        transitions: [
          {
            from_year:
              2024,

            to_year:
              2025,

            organization_changed:
              true,

            position_changed:
              false,

            statement_type:
              "calculation",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "calculation",
              },
            ],
          },
        ],
      },

      related_people: {
        items: [
          {
            item_ref:
              "related-person-ref-v1:secret",

            entity_id:
              "internal-entity-id",

            full_name:
              "Пов’язана Особа",

            relation_type:
              "family_member",

            role:
              "family",

            relationship:
              "дружина",

            years: [
              2025,
            ],

            identity_status:
              "source_observation",

            review_required:
              true,

            source_identity: {
              source_system:
                "nazk",

              source_person_ref:
                "secret-person-ref",
            },

            statement_type:
              "source_fact",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "source_fact",
              },
            ],
          },
        ],
      },

      relations: {
        items: [
          {
            relation_id:
              "internal-relation-id",

            relation_type:
              "employed_by",

            relation_scope:
              "year",

            from_entity_id:
              "internal-from-id",

            from_entity_type:
              "person",

            from_name:
              "Тестовий Суб’єкт",

            to_entity_id:
              "internal-to-id",

            to_entity_type:
              "organization",

            to_name:
              "Організація А",

            label:
              "Місце роботи",

            year:
              2025,

            confidence:
              null,

            verification_status:
              null,

            metadata: {
              source:
                "nazk",

              relation_semantics:
                "declared_employment",

              internal_debug:
                "never-export",
            },

            statement_type:
              "source_fact",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "source_fact",
              },
            ],
          },
        ],
      },

      executive_summary: {
        status:
          "generated",

        items: [
          {
            rule_code:
              "RULE-1",

            severity:
              "review",

            score:
              91,

            message:
              "Тестовий сигнал",

            statement_type:
              "heuristic_signal",

            evidence: [
              {
                source_document_id:
                  SOURCE_ID,

                statement_type:
                  "heuristic_signal",
              },

              {
                source_document_id:
                  "unknown-source",
              },
            ],
          },
        ],
      },

      sources: {
        items: [
          {
            source_document_id:
              SOURCE_ID,

            external_id:
              "internal-external-id",

            provider:
              "official-sites",

            source_type:
              "web",

            title:
              "Офіційне джерело",

            url:
              "https://example.test/source",

            observed_at:
              "2026-08-12T09:00:00.000Z",
          },
        ],
      },

      methodology: {
        report_model_version:
          "report-model-v1",

        analytics_version:
          "report-analytics-v1",

        notes: [
          "Методологічна примітка",
        ],

        limitations: [
          "Методологічне обмеження",
        ],
      },
    },
  };
}

test(
  "builds safe shared export projection",
  () => {
    const result =
      buildDossierExportModel(
        fixture()
      );

    assert.equal(
      result.contract_version,
      DOSSIER_EXPORT_MODEL_VERSION
    );

    assert.equal(
      result.subject.full_name,
      "Тестовий Суб’єкт"
    );

    assert.equal(
      result.brief.sections[0].code,
      "overview"
    );

    assert.deepEqual(
      result.brief.sections[0]
        .source_paths,
      [
        "subject",
        "identity",
      ]
    );

    assert.equal(
      result.executive_summary
        .items[0]
        .evidence.length,
      1
    );

    assert.equal(
      result.executive_summary
        .items[0]
        .evidence[0]
        .url,
      "https://example.test/source"
    );
  }
);

test(
  "projects analytics and media safely",
  () => {
    const result =
      buildDossierExportModel(
        fixture()
      );

    assert.equal(
      result.analytics.metrics[0]
        .income_declarant_uah,
      100000
    );

    assert.equal(
      result.analytics.transitions[0]
        .cash_uah_delta,
      150000
    );

    assert.equal(
      result.analytics.findings[0]
        .rule_code,
      "PM_CASH_UAH_GROWTH_RATIO_V1"
    );

    assert.equal(
      result.analytics.findings[0]
        .details.ratio,
      1.5
    );

    assert.equal(
      result.analytics.findings[0]
        .statement_type,
      "heuristic_signal"
    );

    assert.equal(
      result.mentions.total,
      1
    );

    assert.equal(
      result.mentions.items[0]
        .title,
      "Тестова згадка"
    );

    assert.equal(
      result.mentions.items[0]
        .evidence[0]
        .url,
      "https://example.test/source"
    );
  }
);

test(
  "projects finances and assets safely",
  () => {
    const result =
      buildDossierExportModel(
        fixture()
      );

    assert.equal(
      result.income.yearly[0]
        .household_uah,
      125000
    );

    assert.equal(
      result.income.sources[0]
        .source_details.edrpou,
      "12345678"
    );

    assert.equal(
      result.cash_assets.yearly[0]
        .household_by_currency
        .USD,
      5000
    );

    assert.equal(
      result.real_estate.yearly[0]
        .items[0]
        .location.city,
      "Київ"
    );

    assert.equal(
      result.real_estate.yearly[0]
        .items[0]
        .rights[0]
        .percentage,
      100
    );

    assert.equal(
      result.vehicles.yearly[0]
        .items[0]
        .brand,
      "TEST"
    );

    assert.equal(
      result.vehicles.yearly[0]
        .items[0]
        .production_year,
      2022
    );
  }
);

test(
  "projects career related people and relations safely",
  () => {
    const result =
      buildDossierExportModel(
        fixture()
      );

    assert.equal(
      result.career.items[0]
        .organization,
      "Організація А"
    );

    assert.equal(
      result.career.transitions[0]
        .organization_changed,
      true
    );

    assert.equal(
      result.related_people
        .items[0]
        .full_name,
      "Пов’язана Особа"
    );

    assert.equal(
      result.related_people
        .items[0]
        .review_required,
      true
    );

    assert.equal(
      result.relations.items[0]
        .label,
      "Місце роботи"
    );

    assert.equal(
      result.relations.items[0]
        .source,
      "nazk"
    );

    assert.equal(
      result.relations.items[0]
        .evidence[0]
        .url,
      "https://example.test/source"
    );
  }
);

test(
  "does not expose raw source identifiers",
  () => {
    const result =
      buildDossierExportModel(
        fixture()
      );

    const serialized =
      JSON.stringify(result);

    assert.equal(
      serialized.includes(
        SOURCE_ID
      ),
      false
    );

    assert.equal(
      serialized.includes(
        "internal-external-id"
      ),
      false
    );

    assert.equal(
      serialized.includes(
        "source_document_id"
      ),
      false
    );

    assert.equal(
      serialized.includes(
        "external_id"
      ),
      false
    );

    for (
      const forbidden
      of [
        "related-person-ref-v1:secret",
        "internal-entity-id",
        "secret-person-ref",
        "internal-relation-id",
        "internal-from-id",
        "internal-to-id",
        "never-export",
        "source_person_ref",
        "item_ref",
        "relation_id",
        "from_entity_id",
        "to_entity_id",
        "hidden-income-ref",
        "hidden-cash-ref",
        "hidden-location-code",
        "hidden-right-id",
        "hidden-estate-ref",
        "hidden-vehicle-ref",
        "source_item_ref",
        "tracking_identity",
        "internal_ref",
        "internal_code",
        "internal_id",
        "hidden-transition-ref",
        "hidden-analytics-debug",
        "secret search query",
        "secret search query 2",
        "full article body must never export",
        "raw provider article body",
        "internal_transition_ref",
        "internal_debug",
        "search_query",
        "full_text",
        "provider_article_body",
      ]
    ) {
      assert.equal(
        serialized.includes(
          forbidden
        ),
        false,
        forbidden
      );
    }
  }
);

test(
  "keeps dossier audit metadata",
  () => {
    const result =
      buildDossierExportModel(
        fixture()
      );

    assert.equal(
      result.dossier.version_id,
      "11111111-1111-4111-8111-111111111111"
    );

    assert.equal(
      result.dossier.payload_hash,
      "deadbeef"
    );

    assert.equal(
      result.dossier.payload_hash_version,
      "canonical-json-sha256-v1"
    );
  }
);

test(
  "rejects missing canonical report",
  () => {
    assert.throws(
      () =>
        buildDossierExportModel(
          {}
        ),
      /canonical report/
    );
  }
);
