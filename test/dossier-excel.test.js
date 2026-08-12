import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  buildDossierExcel,
  DOSSIER_EXCEL_CONTENT_TYPE,
  DOSSIER_EXCEL_VERSION,
} from "../src/dossier-excel.js";

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

      freshness: [],
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
        "GUID match",
      ],

      aliases: [],

      reasons: [
        "hard match",
      ],

      hidden_identity:
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
      }],
    },

    career: {
      items: [{
        year:
          2025,

        organization:
          "Організація",

        position:
          "Посада",

        evidence: [],
      }],

      transitions: [],
    },

    related_people: {
      items: [],
    },

    relations: {
      items: [],
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

        evidence: [],
      }],

      sources: [],
    },

    cash_assets: {
      yearly: [],
    },

    real_estate: {
      yearly: [],
    },

    vehicles: {
      yearly: [],
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

        real_estate_items:
          1,

        vehicle_items:
          1,

        relation_count:
          2,

        career: {
          organization:
            "Організація",

          position:
            "Посада",
        },

        evidence: [],
      }],

      transitions: [],

      findings: [],
    },

    mentions: {
      total:
        1,

      items: [{
        provider:
          "google-news",

        source:
          "Example Media",

        title:
          "Тестова згадка",

        snippet:
          "Безпечний фрагмент",

        url:
          "https://example.test/media",

        published_at:
          "2026-08-11T09:00:00.000Z",

        match_level:
          "confirmed",

        match_score:
          92,

        reasons: [
          "name_context_match",
        ],

        query:
          "HIDDEN-QUERY",

        full_text:
          "HIDDEN-FULL-TEXT",
      }],
    },

    sources: [{
      source_type:
        "media",

      provider:
        "google-news",

      title:
        "Example source",

      url:
        "https://example.test/media",

      published_at:
        "2026-08-11T09:00:00.000Z",

      observed_at:
        "2026-08-12T09:00:00.000Z",

      external_id:
        "HIDDEN-EXTERNAL-ID",
    }],

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
    },
  };
}

function workbookText(workbook) {
  const values = [];

  for (
    const worksheet
    of workbook.worksheets
  ) {
    worksheet.eachRow(
      {
        includeEmpty:
          false,
      },
      (row) => {
        row.eachCell(
          {
            includeEmpty:
              false,
          },
          (cell) => {
            const value =
              cell.value;

            if (
              value !== null &&
              value !== undefined
            ) {
              values.push(
                typeof value ===
                  "object"
                  ? JSON.stringify(
                      value
                    )
                  : String(value)
              );
            }
          }
        );
      }
    );
  }

  return values.join(
    "\n"
  );
}

test(
  "builds canonical dossier workbook from export model only",
  async () => {
    const result =
      await buildDossierExcel(
        fixture()
      );

    assert.equal(
      result.version,
      DOSSIER_EXCEL_VERSION
    );

    assert.equal(
      result.contentType,
      DOSSIER_EXCEL_CONTENT_TYPE
    );

    assert.equal(
      result.filename,
      "Тестовий_Суб’єкт_dossier_11111111-222.xlsx"
    );

    assert.ok(
      Buffer.isBuffer(
        result.buffer
      )
    );

    assert.ok(
      result.buffer.length >
      1000
    );

    const workbook =
      new ExcelJS.Workbook();

    await workbook.xlsx.load(
      result.buffer
    );

    assert.deepEqual(
      workbook.worksheets.map(
        (sheet) =>
          sheet.name
      ),
      [
        "Огляд",
        "Ключові сигнали",
        "Кар’єра і зв’язки",
        "Фінанси",
        "Активи",
        "Аналітика",
        "Згадки",
        "Джерела",
        "Методологія",
      ]
    );

    const serialized =
      workbookText(
        workbook
      );

    for (
      const expected
      of [
        "Тестовий Суб’єкт",
        "11111111-2222-4333-8444-555555555555",
        "abc123",
        "Тестовий сигнал",
        "Тестова згадка",
        "Тестове обмеження",
      ]
    ) {
      assert.equal(
        serialized.includes(
          expected
        ),
        true,
        expected
      );
    }

    for (
      const forbidden
      of [
        "HIDDEN-SUBJECT-ID",
        "HIDDEN-IDENTITY",
        "HIDDEN-QUERY",
        "HIDDEN-FULL-TEXT",
        "HIDDEN-EXTERNAL-ID",
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
  "rejects unsupported export model contract",
  async () => {
    await assert.rejects(
      () =>
        buildDossierExcel({
          contract_version:
            "wrong-version",
        }),
      /unsupported dossier export model version/
    );
  }
);
