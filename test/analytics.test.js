import test from "node:test";
import assert from "node:assert/strict";

import {
  compareYearMetrics,
  computeYearMetrics,
} from "../src/analytics.js";

test("aggregates declarant income only", () => {
  const result =
    computeYearMetrics([
      {
        fact_type: "income",
        value_number: 100000,
        unit: "UAH",
        value_json: {
          person: {
            role: "declarant",
          },
        },
      },

      {
        fact_type: "income",
        value_number: 50000,
        unit: "UAH",
        value_json: {
          person: {
            role: "family",
          },
        },
      },
    ]);

  assert.equal(
    result.incomeDeclarantUah,
    100000,
  );

  assert.equal(
    result.incomeHouseholdUah,
    150000,
  );
});

test("keeps currencies separate", () => {
  const result =
    computeYearMetrics([
      {
        fact_type: "cash_asset",
        value_number: 100000,
        unit: "UAH",
        value_json: {
          person: {
            role: "declarant",
          },
        },
      },

      {
        fact_type: "cash_asset",
        value_number: 5000,
        unit: "USD",
        value_json: {
          person: {
            role: "declarant",
          },
        },
      },
    ]);

  assert.deepEqual(
    result.cashDeclarantByCurrency,
    {
      UAH: 100000,
      USD: 5000,
    },
  );
});

test("flags large UAH cash growth vs income", () => {
  const comparison =
    compareYearMetrics(
      {
        year: 2024,
        incomeDeclarantUah:
          100000,

        cashDeclarantByCurrency: {
          UAH: 100000,
        },

        realEstateDeclarantRelated:
          0,

        vehiclesDeclarantRelated:
          0,

        employment: {},
      },

      {
        year: 2025,
        incomeDeclarantUah:
          200000,

        cashDeclarantByCurrency: {
          UAH: 300000,
        },

        realEstateDeclarantRelated:
          0,

        vehiclesDeclarantRelated:
          0,

        employment: {},
      },
    );

  assert.equal(
    comparison.findings.some(
      (item) =>
        item.ruleCode ===
        "AN_CASH_UAH_GROWTH_V1",
    ),
    true,
  );
});

test("does not apply annual cash rule across year gaps", () => {
  const comparison =
    compareYearMetrics(
      {
        year: 2022,
        incomeDeclarantUah:
          100000,

        cashDeclarantByCurrency: {
          UAH: 0,
        },

        realEstateDeclarantRelated:
          0,

        vehiclesDeclarantRelated:
          0,

        employment: {},
      },

      {
        year: 2025,
        incomeDeclarantUah:
          100000,

        cashDeclarantByCurrency: {
          UAH: 1000000,
        },

        realEstateDeclarantRelated:
          0,

        vehiclesDeclarantRelated:
          0,

        employment: {},
      },
    );

  assert.equal(
    comparison.findings.some(
      (item) =>
        item.ruleCode ===
        "AN_CASH_UAH_GROWTH_V1",
    ),
    false,
  );
});
