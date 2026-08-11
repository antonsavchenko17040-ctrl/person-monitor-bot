import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_ANALYTICS_VERSION,
  REPORT_RULES_VERSION,
  buildReportAnalyticsSection,
  buildSubjectReportModelPayload,
} from "../src/report-model.js";

test(
  "report analytics builds metrics transitions and findings",
  () => {
    const analytics =
      buildReportAnalyticsSection({
        availableYears:
          [2025, 2024],

        income: {
          yearly: [
            {
              year:
                2024,

              declarant_uah:
                100,

              household_uah:
                150,

              evidence: [],
            },

            {
              year:
                2025,

              declarant_uah:
                200,

              household_uah:
                250,

              evidence: [],
            },
          ],
        },

        cashAssets: {
          yearly: [
            {
              year:
                2024,

              declarant_by_currency: {
                UAH:
                  100,

                USD:
                  10,
              },

              household_by_currency: {
                UAH:
                  150,

                USD:
                  10,
              },

              evidence: [],
            },

            {
              year:
                2025,

              declarant_by_currency: {
                UAH:
                  300,

                USD:
                  10,
              },

              household_by_currency: {
                UAH:
                  350,

                USD:
                  10,
              },

              evidence: [],
            },
          ],
        },

        realEstate: {
          yearly: [
            {
              year:
                2024,

              items: [
                {
                  evidence: [],
                },
              ],
            },

            {
              year:
                2025,

              items: [
                {
                  evidence: [],
                },

                {
                  evidence: [],
                },
              ],
            },
          ],
        },

        vehicles: {
          yearly: [
            {
              year:
                2024,

              items: [
                {
                  evidence: [],
                },
              ],
            },

            {
              year:
                2025,

              items: [
                {
                  evidence: [],
                },
              ],
            },
          ],
        },

        career: {
          items: [
            {
              year:
                2024,

              organization:
                "Організація",

              position:
                "Посада А",

              evidence: [],
            },

            {
              year:
                2025,

              organization:
                "Організація",

              position:
                "Посада Б",

              evidence: [],
            },
          ],

          transitions: [
            {
              from_year:
                2024,

              to_year:
                2025,

              organization_changed:
                false,

              position_changed:
                true,
            },
          ],
        },

        relations: {
          items: [],
        },
      });

    assert.equal(
      REPORT_ANALYTICS_VERSION,
      "report-analytics-v1",
    );

    assert.equal(
      REPORT_RULES_VERSION,
      "report-rules-v1",
    );

    assert.equal(
      analytics.metrics.length,
      2,
    );

    assert.equal(
      analytics.transitions.length,
      1,
    );

    assert.equal(
      analytics.transitions[0]
        .income_delta_uah,
      100,
    );

    assert.equal(
      analytics.transitions[0]
        .income_delta_percent,
      100,
    );

    assert.equal(
      analytics.transitions[0]
        .cash_uah_delta,
      200,
    );

    assert.equal(
      analytics.metrics[1]
        .cash_declarant_by_currency
        .USD,
      10,
    );

    const codes =
      new Set(
        analytics.findings.map(
          (item) =>
            item.rule_code,
        ),
      );

    assert.equal(
      codes.has(
        "PM_CASH_UAH_GROWTH_RATIO_V1",
      ),
      true,
    );

    assert.equal(
      codes.has(
        "PM_INCOME_CHANGE_50_V1",
      ),
      true,
    );

    assert.equal(
      codes.has(
        "PM_REAL_ESTATE_COUNT_CHANGE_V1",
      ),
      true,
    );

    assert.equal(
      codes.has(
        "PM_CAREER_CHANGE_V1",
      ),
      true,
    );

    assert.equal(
      codes.has(
        "PM_VEHICLE_COUNT_CHANGE_V1",
      ),
      false,
    );

    assert.equal(
      analytics.findings.every(
        (item) =>
          item.statement_type ===
          "heuristic_signal",
      ),
      true,
    );
  },
);


test(
  "executive summary projects deterministic findings with evidence",
  () => {
    const evidence = [
      {
        source_document_id:
          "source-1",

        provider:
          "nazk",

        url:
          "https://example.test/source-1",

        observed_at:
          null,

        statement_type:
          "source_fact",
      },
    ];

    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },

        analytics: {
          metrics: [],

          transitions: [],

          findings: [
            {
              rule_code:
                "PM_TEST_FINDING_V1",

              domain:
                "financial_dynamics",

              result:
                "review",

              severity:
                "review",

              score:
                88,

              message:
                "Потрібна додаткова перевірка фінансової динаміки.",

              details: {
                from_year:
                  2024,

                to_year:
                  2025,
              },

              statement_type:
                "heuristic_signal",

              evidence,
            },
          ],
        },
      });

    assert.deepEqual(
      report.executive_summary,
      {
        status:
          "generated",

        items: [
          {
            rule_code:
              "PM_TEST_FINDING_V1",

            domain:
              "financial_dynamics",

            result:
              "review",

            severity:
              "review",

            score:
              88,

            message:
              "Потрібна додаткова перевірка фінансової динаміки.",

            details: {
              from_year:
                2024,

              to_year:
                2025,
            },

            statement_type:
              "heuristic_signal",

            evidence,
          },
        ],
      },
    );
  },
);


test(
  "executive summary excludes internal finding and evidence fields",
  () => {
    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },

        analytics: {
          findings: [
            {
              rule_code:
                "PM_SAFE_SUMMARY_V1",

              domain:
                "financial_dynamics",

              result:
                "review",

              severity:
                "review",

              score:
                75,

              message:
                "Потрібна перевірка.",

              details: {
                from_year:
                  2024,

                to_year:
                  2025,
              },

              statement_type:
                "heuristic_signal",

              internal_debug:
                "must-not-leak",

              evidence: [
                {
                  source_document_id:
                    "source-1",

                  provider:
                    "nazk",

                  url:
                    "https://example.test/source-1",

                  observed_at:
                    null,

                  statement_type:
                    "source_fact",

                  raw_payload:
                    "must-not-leak",
                },
              ],
            },
          ],
        },
      });

    assert.deepEqual(
      report.executive_summary,
      {
        status:
          "generated",

        items: [
          {
            rule_code:
              "PM_SAFE_SUMMARY_V1",

            domain:
              "financial_dynamics",

            result:
              "review",

            severity:
              "review",

            score:
              75,

            message:
              "Потрібна перевірка.",

            details: {
              from_year:
                2024,

              to_year:
                2025,
            },

            statement_type:
              "heuristic_signal",

            evidence: [
              {
                source_document_id:
                  "source-1",

                provider:
                  "nazk",

                url:
                  "https://example.test/source-1",

                observed_at:
                  null,

                statement_type:
                  "source_fact",
              },
            ],
          },
        ],
      },
    );

    assert.equal(
      JSON.stringify(
        report.executive_summary,
      ).includes(
        "must-not-leak",
      ),
      false,
    );
  },
);


test(
  "executive summary prioritizes and limits findings",
  () => {
    const findings =
      Array.from(
        {
          length:
            10,
        },
        (_, index) => ({
          rule_code:
            `PM_INFO_${index}_V1`,

          domain:
            "asset_dynamics",

          result:
            "change",

          severity:
            "info",

          score:
            100 - index,

          message:
            `Info ${index}`,

          details: {
            from_year:
              2024,

            to_year:
              2025,
          },

          statement_type:
            "heuristic_signal",

          evidence: [],
        }),
      );

    findings.push({
      rule_code:
        "PM_REVIEW_LOW_SCORE_V1",

      domain:
        "financial_dynamics",

      result:
        "review",

      severity:
        "review",

      score:
        10,

      message:
        "Review signal",

      details: {
        from_year:
          2024,

        to_year:
          2025,
      },

      statement_type:
        "heuristic_signal",

      evidence: [],
    });

    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },

        analytics: {
          findings,
        },
      });

    assert.equal(
      report
        .executive_summary
        .items
        .length,
      8,
    );

    assert.equal(
      report
        .executive_summary
        .items[0]
        .rule_code,
      "PM_REVIEW_LOW_SCORE_V1",
    );

    assert.deepEqual(
      report
        .executive_summary
        .items
        .slice(1)
        .map(
          (item) =>
            item.rule_code,
        ),
      [
        "PM_INFO_0_V1",
        "PM_INFO_1_V1",
        "PM_INFO_2_V1",
        "PM_INFO_3_V1",
        "PM_INFO_4_V1",
        "PM_INFO_5_V1",
        "PM_INFO_6_V1",
      ],
    );
  },
);


test(
  "executive summary resolves evidence through canonical sources",
  () => {
    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },

        analytics: {
          findings: [
            {
              rule_code:
                "PM_CANONICAL_EVIDENCE_V1",

              domain:
                "financial_dynamics",

              result:
                "review",

              severity:
                "review",

              score:
                90,

              message:
                "Потрібна перевірка.",

              details: {
                from_year:
                  2024,

                to_year:
                  2025,
              },

              statement_type:
                "heuristic_signal",

              evidence: [
                {
                  source_document_id:
                    "source-1",

                  provider:
                    "untrusted-provider",

                  url:
                    "https://untrusted.example/source-1",

                  observed_at:
                    "1999-01-01T00:00:00.000Z",

                  statement_type:
                    "source_fact",
                },

                {
                  source_document_id:
                    "missing-source",

                  provider:
                    "untrusted-provider",

                  url:
                    "https://untrusted.example/missing",

                  observed_at:
                    null,

                  statement_type:
                    "source_fact",
                },
              ],
            },
          ],
        },

        sources: {
          items: [
            {
              source_document_id:
                "source-1",

              source_type:
                "declaration",

              provider:
                "nazk",

              external_id:
                "doc-1",

              title:
                "Canonical source",

              url:
                "https://canonical.example/source-1",

              published_at:
                "2025-01-01T00:00:00.000Z",

              observed_at:
                "2025-01-02T00:00:00.000Z",
            },
          ],
        },
      });

    assert.deepEqual(
      report
        .executive_summary
        .items[0]
        .evidence,
      [
        {
          source_document_id:
            "source-1",

          provider:
            "nazk",

          url:
            "https://canonical.example/source-1",

          observed_at:
            "2025-01-02T00:00:00.000Z",

          statement_type:
            "source_fact",
        },
      ],
    );

    assert.equal(
      JSON.stringify(
        report.executive_summary,
      ).includes(
        "untrusted.example",
      ),
      false,
    );

    assert.equal(
      JSON.stringify(
        report.executive_summary,
      ).includes(
        "missing-source",
      ),
      false,
    );
  },
);


test(
  "executive summary omits findings without canonical evidence",
  () => {
    const finding = {
      rule_code:
        "PM_UNRESOLVED_EVIDENCE_V1",

      domain:
        "financial_dynamics",

      result:
        "review",

      severity:
        "review",

      score:
        95,

      message:
        "Сигнал залишається в analytics.",

      details: {
        from_year:
          2024,

        to_year:
          2025,
      },

      statement_type:
        "heuristic_signal",

      evidence: [
        {
          source_document_id:
            "missing-source",

          provider:
            "untrusted-provider",

          url:
            "https://untrusted.example/missing",

          observed_at:
            null,

          statement_type:
            "source_fact",
        },
      ],
    };

    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },

        analytics: {
          findings: [
            finding,
          ],
        },

        sources: {
          items: [],
        },
      });

    assert.deepEqual(
      report.executive_summary,
      {
        status:
          "not_generated",

        items: [],
      },
    );

    assert.equal(
      report
        .analytics
        .findings
        .length,
      1,
    );

    assert.equal(
      report
        .analytics
        .findings[0]
        .rule_code,
      "PM_UNRESOLVED_EVIDENCE_V1",
    );
  },
);


test(
  "executive summary filters unresolved evidence before top eight limit",
  () => {
    const supportedFindings =
      Array.from(
        {
          length:
            9,
        },
        (_, index) => ({
          rule_code:
            `PM_SUPPORTED_${index}_V1`,

          domain:
            "asset_dynamics",

          result:
            "change",

          severity:
            "info",

          score:
            100 - index,

          message:
            `Supported ${index}`,

          details: {
            from_year:
              2024,

            to_year:
              2025,
          },

          statement_type:
            "heuristic_signal",

          evidence: [
            {
              source_document_id:
                `source-${index}`,

              provider:
                "untrusted-provider",

              url:
                `https://untrusted.example/source-${index}`,

              observed_at:
                null,

              statement_type:
                "source_fact",
            },
          ],
        }),
      );

    const unresolvedReview = {
      rule_code:
        "PM_UNRESOLVED_REVIEW_V1",

      domain:
        "financial_dynamics",

      result:
        "review",

      severity:
        "review",

      score:
        999,

      message:
        "Unsupported review signal",

      details: {
        from_year:
          2024,

        to_year:
          2025,
      },

      statement_type:
        "heuristic_signal",

      evidence: [
        {
          source_document_id:
            "missing-source",

          provider:
            "untrusted-provider",

          url:
            "https://untrusted.example/missing",

          observed_at:
            null,

          statement_type:
            "source_fact",
        },
      ],
    };

    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },

        analytics: {
          findings: [
            unresolvedReview,
            ...supportedFindings,
          ],
        },

        sources: {
          items:
            supportedFindings.map(
              (_, index) => ({
                source_document_id:
                  `source-${index}`,

                provider:
                  "nazk",

                url:
                  `https://canonical.example/source-${index}`,

                observed_at:
                  null,
              }),
            ),
        },
      });

    assert.equal(
      report
        .executive_summary
        .items
        .length,
      8,
    );

    assert.deepEqual(
      report
        .executive_summary
        .items
        .map(
          (item) =>
            item.rule_code,
        ),
      [
        "PM_SUPPORTED_0_V1",
        "PM_SUPPORTED_1_V1",
        "PM_SUPPORTED_2_V1",
        "PM_SUPPORTED_3_V1",
        "PM_SUPPORTED_4_V1",
        "PM_SUPPORTED_5_V1",
        "PM_SUPPORTED_6_V1",
        "PM_SUPPORTED_7_V1",
      ],
    );

    assert.equal(
      report
        .executive_summary
        .items
        .some(
          (item) =>
            item.rule_code ===
            "PM_UNRESOLVED_REVIEW_V1",
        ),
      false,
    );
  },
);
