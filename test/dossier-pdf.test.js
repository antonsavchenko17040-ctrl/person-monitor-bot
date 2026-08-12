import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDossierPdf,
  buildDossierPdfContent,
  DOSSIER_PDF_CONTENT_TYPE,
  DOSSIER_PDF_VERSION,
} from "../src/dossier-pdf.js";

import {
  DOSSIER_EXPORT_MODEL_VERSION,
} from "../src/dossier-export-model.js";


function fixture() {
  return {
    contract_version:
      DOSSIER_EXPORT_MODEL_VERSION,

    dossier: {
      version_id:
        "11111111-2222-4333-8444-555555555555",

      status:
        "completed",

      report_schema_version:
        "report-model-v1",

      report_generated_at:
        "2026-08-12T10:00:00.000Z",

      payload_hash:
        "abc123",

      payload_hash_version:
        "canonical-json-sha256-v1",

      created_at:
        "2026-08-12T10:01:00.000Z",
    },

    meta: {
      schema_version:
        "report-model-v1",

      analytics_version:
        "report-analytics-v1",

      period: {
        from_year:
          2024,

        to_year:
          2025,
      },

      available_years: [
        2025,
        2024,
      ],

      freshness: [
        "snapshot",
      ],
    },

    subject: {
      full_name:
        "Тестовий Суб’єкт",

      position:
        "Посада",

      organization:
        "Організація",

      city:
        "Київ",

      status:
        "active",

      id:
        "HIDDEN-SUBJECT-ID",
    },

    identity: {
      resolution_status:
        "confirmed",

      score:
        98,

      hard_match:
        true,

      review_required:
        false,

      identifiers: [
        "public-identifier",
      ],

      aliases: [
        "Тестовий Псевдонім",
      ],

      reasons: [
        "hard match",
      ],

      internal_identity:
        "HIDDEN-IDENTITY",
    },

    declarations: {
      items: [{
        year:
          2025,

        registry:
          "NAZK",

        document_guid:
          "public-guid",

        published_at:
          "2026-01-01T00:00:00.000Z",

        canonical:
          true,

        source_url:
          "https://example.test/declaration",

        evidence: [],

        source_document_id:
          "HIDDEN-SOURCE-ID",
      }],
    },

    executive_summary: {
      status:
        "generated",

      items: [{
        rule_code:
          "PM_TEST_V1",

        domain:
          "test",

        result:
          "review",

        severity:
          "review",

        score:
          80,

        message:
          "Тестовий сигнал",

        evidence: [{
          url:
            "https://example.test/evidence",
        }],

        hidden:
          "HIDDEN-FINDING",
      }],
    },



    income: {
      yearly: [{
        year:
          2025,

        declarant_uah:
          100000,

        family_uah:
          25000,

        household_uah:
          125000,

        statement_type:
          "calculation",

        evidence: [{
          url:
            "https://example.test/income-year",
        }],

        source_document_id:
          "HIDDEN-INCOME-YEAR-SOURCE",
      }],

      sources: [{
        year:
          2025,

        recipient_role:
          "declarant",

        recipient_name:
          "Тестовий Суб’єкт",

        recipient_relationship:
          null,

        income_type:
          "salary",

        other_income_type:
          null,

        amount:
          100000,

        currency:
          "UAH",

        source:
          "Організація А",

        source_details: {
          legal_entity_name:
            "Організація А",

          legal_entity_code:
            "LEGAL-001",

          edrpou:
            "12345678",

          foreign_company_name:
            null,

          foreign_company_code:
            null,

          person_name:
            null,

          hidden_detail:
            "HIDDEN-SOURCE-DETAIL",
        },

        statement_type:
          "source_fact",

        evidence: [{
          url:
            "https://example.test/income-source",
        }],

        source_item_ref:
          "HIDDEN-INCOME-ITEM-REF",
      }],
    },

    cash_assets: {
      yearly: [{
        year:
          2025,

        declarant_by_currency: {
          UAH:
            200000,

          USD:
            5000,
        },

        household_by_currency: {
          UAH:
            250000,
        },

        items: [{
          asset_type:
            "cash",

          other_asset_type:
            null,

          amount:
            200000,

          currency:
            "UAH",

          organization_type:
            "bank",

          organization_name:
            "Тестовий Банк",

          owner_role:
            "declarant",

          owner_name:
            "Тестовий Суб’єкт",

          owner_relationship:
            null,

          rights: [{
            right_type:
              "ownership",

            ownership_percentage:
              100,

            percentage:
              null,

            share:
              null,

            owner_role:
              "declarant",

            owner_name:
              "Тестовий Суб’єкт",

            owner_relationship:
              null,

            hidden_right:
              "HIDDEN-RIGHT",
          }],

          statement_type:
            "source_fact",

          evidence: [{
            url:
              "https://example.test/cash-item",
          }],

          tracking_identity:
            "HIDDEN-TRACKING",

          source_item_ref:
            "HIDDEN-CASH-REF",
        }],

        evidence: [{
          url:
            "https://example.test/cash-year",
        }],

        source_document_id:
          "HIDDEN-CASH-YEAR-SOURCE",
      }],
    },


    real_estate: {
      yearly: [{
        year:
          2025,

        items: [{
          object_type:
            "apartment",

          other_object_type:
            null,

          area:
            87.5,

          area_unit:
            "m2",

          location: {
            country:
              "Україна",

            region:
              "Київ",

            district:
              "Печерський",

            city:
              "Київ",

            street:
              "HIDDEN-STREET",
          },

          acquisition_date:
            "2020-01-02",

          cost:
            3500000,

          owner_role:
            "declarant",

          owner_name:
            "Тестовий Суб’єкт",

          owner_relationship:
            null,

          rights: [{
            right_type:
              "ownership",

            ownership_percentage:
              100,

            hidden_right:
              "HIDDEN-ESTATE-RIGHT",
          }],

          statement_type:
            "source_fact",

          evidence: [{
            url:
              "https://example.test/estate",
          }],

          source_item_ref:
            "HIDDEN-ESTATE-REF",

          tracking_identity:
            "HIDDEN-ESTATE-TRACKING",
        }],

        evidence: [],
      }],
    },

    vehicles: {
      yearly: [{
        year:
          2025,

        items: [{
          object_type:
            "car",

          other_object_type:
            null,

          brand:
            "Volvo",

          model:
            "XC90",

          production_year:
            2022,

          acquisition_date:
            "2023-03-04",

          cost:
            2400000,

          owner_role:
            "declarant",

          owner_name:
            "Тестовий Суб’єкт",

          owner_relationship:
            null,

          rights: [{
            right_type:
              "ownership",

            percentage:
              100,

            hidden_right:
              "HIDDEN-VEHICLE-RIGHT",
          }],

          statement_type:
            "source_fact",

          evidence: [{
            url:
              "https://example.test/vehicle",
          }],

          source_item_ref:
            "HIDDEN-VEHICLE-REF",

          external_id:
            "HIDDEN-VEHICLE-EXTERNAL",
        }],

        evidence: [],
      }],
    },


    analytics: {
      metrics: [{
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
        },

        real_estate_items:
          1,

        vehicle_items:
          1,

        relation_count:
          3,

        career: {
          organization:
            "Організація А",

          position:
            "Керівник",

          internal_id:
            "HIDDEN-ANALYTICS-CAREER",
        },

        statement_type:
          "calculation",

        evidence: [],

        source_document_id:
          "HIDDEN-ANALYTICS-METRIC",
      }],

      transitions: [{
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
          100000,

        real_estate_count_delta:
          1,

        vehicle_count_delta:
          0,

        organization_changed:
          true,

        position_changed:
          false,

        statement_type:
          "calculation",

        evidence: [],

        source_item_ref:
          "HIDDEN-ANALYTICS-TRANSITION",
      }],

      findings: [{
        rule_code:
          "PM_TEST_ANALYTICS_V1",

        domain:
          "finance",

        result:
          "review",

        severity:
          "medium",

        score:
          80,

        message:
          "Тестовий аналітичний сигнал",

        details: {
          from_year:
            2024,

          to_year:
            2025,

          income_delta_uah:
            50000,

          income_delta_percent:
            100,

          hidden_detail:
            "HIDDEN-ANALYTICS-DETAIL",
        },

        statement_type:
          "heuristic_signal",

        evidence: [],

        entity_id:
          "HIDDEN-ANALYTICS-FINDING",
      }],
    },


    mentions: {
      total:
        1,

      items: [{
        provider:
          "google-news",

        source:
          "Тестове медіа",

        title:
          "Тестова публікація про суб’єкта",

        snippet:
          "У матеріалі згадується Тестовий Суб’єкт у релевантному контексті.",

        url:
          "https://example.test/article",

        published_at:
          "2026-08-10T09:00:00.000Z",

        first_seen_at:
          "2026-08-10T10:00:00.000Z",

        match_score:
          0.91,

        match_level:
          "confirmed",

        reasons: [
          "name_context_match",
          "organization_match",
        ],

        statement_type:
          "source_fact",

        evidence: [{
          url:
            "https://example.test/article",
        }],

        source_document_id:
          "HIDDEN-MENTION-SOURCE-ID",

        query:
          "HIDDEN-SEARCH-QUERY",

        search_query:
          "HIDDEN-SEARCH-QUERY-2",

        full_text:
          "HIDDEN-FULL-ARTICLE-TEXT",

        provider_full_text:
          "HIDDEN-PROVIDER-TEXT",

        external_id:
          "HIDDEN-MENTION-EXTERNAL-ID",
      }],
    },

    career: {
      items: [{
        year:
          2025,

        organization:
          "Організація А",

        position:
          "Керівник",

        statement_type:
          "source_fact",

        evidence: [{
          url:
            "https://example.test/career",
        }],

        source_item_ref:
          "HIDDEN-CAREER-REF",
      }],

      transitions: [{
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

        evidence: [],
      }],
    },

    related_people: {
      items: [{
        full_name:
          "Пов’язана Особа",

        relation_type:
          "family",

        role:
          "relative",

        relationship:
          "spouse",

        years: [
          2024,
          2025,
        ],

        identity_status:
          "confirmed",

        review_required:
          false,

        statement_type:
          "source_fact",

        evidence: [{
          url:
            "https://example.test/person",
        }],

        entity_id:
          "HIDDEN-PERSON-ENTITY",

        source_person_ref:
          "HIDDEN-PERSON-REF",
      }],
    },

    relations: {
      items: [{
        relation_type:
          "career",

        relation_scope:
          "year",

        label:
          "Працює в",

        from_entity_type:
          "person",

        from_name:
          "Тестовий Суб’єкт",

        to_entity_type:
          "organization",

        to_name:
          "Організація А",

        year:
          2025,

        confidence:
          0.95,

        verification_status:
          "confirmed",

        source:
          "declaration",

        relation_semantics:
          "employment",

        statement_type:
          "source_fact",

        evidence: [{
          url:
            "https://example.test/relation",
        }],

        relation_id:
          "HIDDEN-RELATION-ID",

        from_entity_id:
          "HIDDEN-FROM-ID",

        to_entity_id:
          "HIDDEN-TO-ID",
      }],
    },

    methodology: {
      report_model_version:
        "report-model-v1",

      analytics_version:
        "report-analytics-v1",

      rules_version:
        "report-rules-v1",

      analytical_brief_version:
        "analytical-brief-v1",

      evidence_policy_version:
        "report-evidence-policy-v1",

      manual_review_manifest_version:
        "manual-review-manifest-v1",

      notes: [
        "Тестова примітка",
      ],

      limitations: [
        "Тестове обмеження",
      ],

      hidden:
        "HIDDEN-METHODOLOGY",
    },
  };
}


test(
  "projects PDF foundation through explicit safe fields",
  () => {
    const content =
      buildDossierPdfContent(
        fixture()
      );

    assert.equal(
      content.subject
        .full_name,
      "Тестовий Суб’єкт"
    );

    assert.equal(
      content.audit
        .dossier_version_id,
      "11111111-2222-4333-8444-555555555555"
    );

    assert.equal(
      content.audit
        .payload_hash,
      "abc123"
    );

    assert.equal(
      content.declarations[0]
        .document_guid,
      "public-guid"
    );

    assert.equal(
      content
        .executive_summary
        .items[0]
        .message,
      "Тестовий сигнал"
    );

    assert.equal(
      content.income
        .yearly[0]
        .household_uah,
      125000
    );

    assert.equal(
      content.income
        .sources[0]
        .source_details
        .edrpou,
      "12345678"
    );

    assert.deepEqual(
      content.cash_assets
        .yearly[0]
        .declarant_by_currency,
      {
        UAH:
          200000,

        USD:
          5000,
      }
    );

    assert.equal(
      content.cash_assets
        .yearly[0]
        .items[0]
        .organization_name,
      "Тестовий Банк"
    );

    assert.equal(
      content.cash_assets
        .yearly[0]
        .items[0]
        .rights[0]
        .ownership_percentage,
      100
    );

    assert.equal(
      content.mentions
        .total,
      1
    );

    assert.equal(
      content.mentions
        .items[0]
        .provider,
      "google-news"
    );

    assert.equal(
      content.mentions
        .items[0]
        .title,
      "Тестова публікація про суб’єкта"
    );

    assert.equal(
      content.mentions
        .items[0]
        .match_score,
      0.91
    );

    assert.deepEqual(
      content.mentions
        .items[0]
        .reasons,
      [
        "name_context_match",
        "organization_match",
      ]
    );

    assert.equal(
      content.analytics
        .metrics[0]
        .income_declarant_uah,
      100000
    );

    assert.equal(
      content.analytics
        .metrics[0]
        .career
        .organization,
      "Організація А"
    );

    assert.equal(
      content.analytics
        .transitions[0]
        .organization_changed,
      "Так"
    );

    assert.equal(
      content.analytics
        .findings[0]
        .rule_code,
      "PM_TEST_ANALYTICS_V1"
    );

    assert.deepEqual(
      content.analytics
        .findings[0]
        .details,
      {
        from_year:
          2024,

        to_year:
          2025,

        income_delta_uah:
          50000,

        income_delta_percent:
          100,
      }
    );

    assert.equal(
      content.real_estate
        .yearly[0]
        .items[0]
        .location
        .city,
      "Київ"
    );

    assert.equal(
      content.real_estate
        .yearly[0]
        .items[0]
        .location
        .street,
      undefined
    );

    assert.equal(
      content.real_estate
        .yearly[0]
        .items[0]
        .cost,
      3500000
    );

    assert.equal(
      content.vehicles
        .yearly[0]
        .items[0]
        .brand,
      "Volvo"
    );

    assert.equal(
      content.vehicles
        .yearly[0]
        .items[0]
        .production_year,
      2022
    );

    assert.equal(
      content.career
        .items[0]
        .organization,
      "Організація А"
    );

    assert.equal(
      content.career
        .transitions[0]
        .organization_changed,
      "Так"
    );

    assert.equal(
      content.related_people
        .items[0]
        .full_name,
      "Пов’язана Особа"
    );

    assert.deepEqual(
      content.related_people
        .items[0]
        .years,
      [
        "2024",
        "2025",
      ]
    );

    assert.equal(
      content.relations
        .items[0]
        .to_name,
      "Організація А"
    );

    assert.equal(
      content.relations
        .items[0]
        .confidence,
      0.95
    );

    const serialized =
      JSON.stringify(
        content
      );

    for (
      const forbidden
      of [
        "HIDDEN-SUBJECT-ID",
        "HIDDEN-IDENTITY",
        "HIDDEN-SOURCE-ID",
        "HIDDEN-FINDING",
        "HIDDEN-METHODOLOGY",
        "HIDDEN-MENTION-SOURCE-ID",
        "HIDDEN-SEARCH-QUERY",
        "HIDDEN-SEARCH-QUERY-2",
        "HIDDEN-FULL-ARTICLE-TEXT",
        "HIDDEN-PROVIDER-TEXT",
        "HIDDEN-MENTION-EXTERNAL-ID",
        "search_query",
        "full_text",
        "provider_full_text",
        "external_id",
        "HIDDEN-ANALYTICS-CAREER",
        "HIDDEN-ANALYTICS-METRIC",
        "HIDDEN-ANALYTICS-TRANSITION",
        "HIDDEN-ANALYTICS-DETAIL",
        "HIDDEN-ANALYTICS-FINDING",
        "HIDDEN-STREET",
        "HIDDEN-ESTATE-RIGHT",
        "HIDDEN-ESTATE-REF",
        "HIDDEN-ESTATE-TRACKING",
        "HIDDEN-VEHICLE-RIGHT",
        "HIDDEN-VEHICLE-REF",
        "HIDDEN-VEHICLE-EXTERNAL",
        "HIDDEN-INCOME-YEAR-SOURCE",
        "HIDDEN-INCOME-ITEM-REF",
        "HIDDEN-SOURCE-DETAIL",
        "HIDDEN-CASH-YEAR-SOURCE",
        "HIDDEN-TRACKING",
        "HIDDEN-CASH-REF",
        "HIDDEN-RIGHT",
        "HIDDEN-CAREER-REF",
        "HIDDEN-PERSON-ENTITY",
        "HIDDEN-PERSON-REF",
        "HIDDEN-RELATION-ID",
        "HIDDEN-FROM-ID",
        "HIDDEN-TO-ID",
        "source_document_id",
        "source_item_ref",
        "source_person_ref",
        "entity_id",
        "relation_id",
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
  "projects canonical source catalog through safe PDF fields",
  () => {
    const input =
      fixture();

    input.sources = [{
      provider:
        "nazk",

      source_type:
        "declaration",

      title:
        "Тестове першоджерело",

      url:
        "https://example.test/source",

      published_at:
        "2026-08-01T08:00:00.000Z",

      observed_at:
        "2026-08-01T09:00:00.000Z",

      source_document_id:
        "HIDDEN-P7-SOURCE-ID",

      external_id:
        "HIDDEN-P7-EXTERNAL-ID",

      query:
        "HIDDEN-P7-QUERY",

      full_text:
        "HIDDEN-P7-FULL-TEXT",
    }];

    const content =
      buildDossierPdfContent(
        input
      );

    assert.equal(
      content.sources.length,
      1
    );

    assert.deepEqual(
      content.sources[0],
      {
        provider:
          "nazk",

        source_type:
          "declaration",

        title:
          "Тестове першоджерело",

        url:
          "https://example.test/source",

        published_at:
          "2026-08-01T08:00:00.000Z",

        observed_at:
          "2026-08-01T09:00:00.000Z",
      }
    );

    const serialized =
      JSON.stringify(
        content.sources
      );

    for (
      const forbidden
      of [
        "HIDDEN-P7-SOURCE-ID",
        "HIDDEN-P7-EXTERNAL-ID",
        "HIDDEN-P7-QUERY",
        "HIDDEN-P7-FULL-TEXT",
        "source_document_id",
        "external_id",
        "query",
        "full_text",
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
  "builds canonical Cyrillic PDF from export model",
  async () => {
    const result =
      await buildDossierPdf(
        fixture()
      );

    assert.equal(
      result.version,
      DOSSIER_PDF_VERSION
    );

    assert.equal(
      result.contentType,
      DOSSIER_PDF_CONTENT_TYPE
    );

    assert.equal(
      result.filename,
      "Тестовий_Суб’єкт_dossier_11111111-222.pdf"
    );

    assert.ok(
      Buffer.isBuffer(
        result.buffer
      )
    );

    assert.ok(
      result.buffer.length >
      5000
    );

    assert.equal(
      result.buffer
        .subarray(
          0,
          5
        )
        .toString(
          "ascii"
        ),
      "%PDF-"
    );
  }
);


test(
  "rejects unsupported PDF export model contract",
  async () => {
    await assert.rejects(
      () =>
        buildDossierPdf({
          contract_version:
            "wrong-version",
        }),
      /unsupported dossier export model version/
    );
  }
);
