import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubjectReportModelPayload,
} from "../src/report-model.js";


test(
  "analytical brief exposes stable ordered canonical sections",
  () => {
    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "Тестова Особа",
        },
      });

    assert.deepEqual(
      report.analytical_brief,
      {
        version:
          "analytical-brief-v1",

        sections: [
          {
            code:
              "overview",

            title:
              "Профіль та декларації",

            source_paths: [
              "meta",
              "subject",
              "identity",
              "declarations",
            ],
          },

          {
            code:
              "key_findings",

            title:
              "Ключові сигнали",

            source_paths: [
              "executive_summary",
            ],
          },

          {
            code:
              "career_relations",

            title:
              "Кар’єра та зв’язки",

            source_paths: [
              "career",
              "related_people",
              "relations",
            ],
          },

          {
            code:
              "finances",

            title:
              "Доходи та грошові активи",

            source_paths: [
              "income",
              "cash_assets",
            ],
          },

          {
            code:
              "assets",

            title:
              "Нерухомість та транспорт",

            source_paths: [
              "real_estate",
              "vehicles",
            ],
          },

          {
            code:
              "analytics",

            title:
              "Аналітика та зміни",

            source_paths: [
              "analytics",
            ],
          },

          {
            code:
              "media",

            title:
              "Релевантні згадки",

            source_paths: [
              "mentions",
            ],
          },

          {
            code:
              "evidence",

            title:
              "Джерела та методологія",

            source_paths: [
              "sources",
              "methodology",
            ],
          },
        ],
      },
    );

    const paths =
      report
        .analytical_brief
        .sections
        .flatMap(
          (section) =>
            section.source_paths,
        );

    assert.equal(
      new Set(paths).size,
      paths.length,
    );

    for (
      const path
      of paths
    ) {
      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            report,
            path,
          ),
        true,
      );
    }
  },
);


test(
  "analytical brief manifest does not duplicate report facts",
  () => {
    const report =
      buildSubjectReportModelPayload({
        subject: {
          id:
            "11111111-1111-4111-8111-111111111111",

          full_name:
            "УНІКАЛЬНЕ ІМЯ ДЛЯ ТЕСТУ",
        },

        analytics: {
          findings: [
            {
              rule_code:
                "PM_BRIEF_ISOLATION_V1",

              domain:
                "financial_dynamics",

              result:
                "review",

              severity:
                "review",

              score:
                90,

              message:
                "УНІКАЛЬНИЙ ТЕКСТ СИГНАЛУ",

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
                    "https://unique.example/source-1",

                  observed_at:
                    null,

                  statement_type:
                    "source_fact",
                },
              ],
            },
          ],
        },
      });

    const serialized =
      JSON.stringify(
        report.analytical_brief,
      );

    for (
      const forbidden
      of [
        "УНІКАЛЬНЕ ІМЯ ДЛЯ ТЕСТУ",
        "УНІКАЛЬНИЙ ТЕКСТ СИГНАЛУ",
        "PM_BRIEF_ISOLATION_V1",
        "https://unique.example/source-1",
        "source-1",
      ]
    ) {
      assert.equal(
        serialized.includes(
          forbidden,
        ),
        false,
      );
    }

    assert.deepEqual(
      Object.keys(
        report.analytical_brief,
      ).sort(),
      [
        "sections",
        "version",
      ],
    );

    for (
      const section
      of report
        .analytical_brief
        .sections
    ) {
      assert.deepEqual(
        Object.keys(
          section,
        ).sort(),
        [
          "code",
          "source_paths",
          "title",
        ],
      );
    }
  },
);
