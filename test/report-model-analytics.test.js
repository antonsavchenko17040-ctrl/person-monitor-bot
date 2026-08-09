import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_ANALYTICS_VERSION,
  REPORT_RULES_VERSION,
  buildReportAnalyticsSection,
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
