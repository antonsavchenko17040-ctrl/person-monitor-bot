import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSET_TRANSACTION_SIGNAL_VERSION,
  sumDeclarantIncomeUah,
  extractDeclaredYear,
  findDisposalIncomeCandidates,
  assessAssetTransitionFinancialSignals,
} from "../src/asset-transaction-signals.js";

function income({
  type =
    "Заробітна плата",
  amount =
    500000,
  role =
    "declarant",
} = {}) {
  return {
    fact_type:
      "income",

    value_text:
      type,

    value_number:
      amount,

    unit:
      "UAH",

    value_json: {
      person: {
        role,
      },

      income_type:
        type,

      other_income_type:
        null,

      source:
        "Тестове джерело",
    },
  };
}

function appeared({
  cost =
    600000,
  date =
    "15.06.2025",
  gap = 1,
} = {}) {
  return {
    event_type:
      "appeared",

    asset_type:
      "vehicle",

    asset_key:
      "vehicle|toyota|camry|2020",

    from_year:
      2025 - gap,

    to_year:
      2025,

    year_gap:
      gap,

    transaction_status:
      "not_inferred",

    fact: {
      fact_type:
        "vehicle",

      value_json: {
        cost,

        acquisition_date:
          date,
      },
    },
  };
}

function disappeared({
  assetType =
    "vehicle",
  gap = 1,
} = {}) {
  return {
    event_type:
      "disappeared",

    asset_type:
      assetType,

    asset_key:
      assetType +
      "|synthetic",

    from_year:
      2025 - gap,

    to_year:
      2025,

    year_gap:
      gap,

    transaction_status:
      "not_inferred",

    fact: {
      fact_type:
        assetType,
      value_json: {},
    },
  };
}

test(
  "exports transaction signal version",
  () => {
    assert.equal(
      ASSET_TRANSACTION_SIGNAL_VERSION,
      "asset-transaction-signal-v1",
    );
  },
);

test(
  "sums only declarant UAH income",
  () => {
    assert.equal(
      sumDeclarantIncomeUah([
        income({
          amount:
            300000,
        }),

        income({
          amount:
            200000,
        }),

        income({
          amount:
            900000,
          role:
            "family",
        }),
      ]),
      500000,
    );
  },
);

test(
  "extracts one declared year",
  () => {
    assert.equal(
      extractDeclaredYear(
        "15.06.2025",
      ),
      2025,
    );

    assert.equal(
      extractDeclaredYear(
        "невідомо",
      ),
      null,
    );
  },
);

test(
  "appeared asset with date and cost is acquisition-supported, not purchased",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        appeared(),
        [
          income({
            amount:
              800000,
          }),
        ],
      );

    assert.equal(
      result.financial_status,
      "acquisition_supported",
    );

    assert.equal(
      result.transaction_status,
      "not_inferred",
    );

    assert.equal(
      result.acquisition
        .acquisition_in_transition_window,
      true,
    );
  },
);

test(
  "cost above annual income requires funding context but proves nothing",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        appeared({
          cost:
            1200000,
        }),
        [
          income({
            amount:
              400000,
          }),
        ],
      );

    assert.equal(
      result.acquisition
        .cost_income_ratio,
      3,
    );

    assert.ok(
      result.findings.some(
        (item) =>
          item.code ===
            "funding_context_required",
      ),
    );

    assert.equal(
      result.transaction_status,
      "not_inferred",
    );
  },
);


test(
  "acquisition date outside transition window is not supporting",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        appeared({
          date:
            "15.06.2023",
        }),
        [],
      );

    assert.equal(
      result.acquisition
        .acquisition_in_transition_window,
      false,
    );

    assert.equal(
      result.financial_status,
      "partial_acquisition_signal",
    );
  },
);

test(
  "vehicle disposal income is a candidate, not proof of sale",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        disappeared(),
        [
          income({
            type:
              "Дохід від відчуження рухомого майна",
            amount:
              450000,
          }),
        ],
      );

    assert.equal(
      result.financial_status,
      "disposal_income_candidate",
    );

    assert.equal(
      result.disposal
        .candidate_count,
      1,
    );

    assert.equal(
      result.transaction_status,
      "not_inferred",
    );
  },
);

test(
  "real estate disposal income matches real estate category",
  () => {
    const candidates =
      findDisposalIncomeCandidates(
        [
          income({
            type:
              "Дохід від відчуження нерухомого майна",
          }),
        ],
        "real_estate",
      );

    assert.equal(
      candidates.specificity,
      "asset_type",
    );

    assert.equal(
      candidates.selected.length,
      1,
    );
  },
);

test(
  "ordinary salary is not disposal evidence",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        disappeared(),
        [
          income(),
        ],
      );

    assert.equal(
      result.financial_status,
      "no_disposal_income_signal",
    );

    assert.equal(
      result.disposal
        .candidate_count,
      0,
    );
  },
);

test(
  "multiple disposal incomes stay ambiguous",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        disappeared(),
        [
          income({
            type:
              "Дохід від відчуження рухомого майна",
            amount:
              300000,
          }),

          income({
            type:
              "Продаж транспортного засобу",
            amount:
              500000,
          }),
        ],
      );

    assert.equal(
      result.financial_status,
      "ambiguous_disposal_income",
    );

    assert.equal(
      result.disposal
        .candidate_count,
      2,
    );

    assert.equal(
      result.transaction_status,
      "not_inferred",
    );
  },
);

test(
  "year gap reduces temporal precision",
  () => {
    const result =
      assessAssetTransitionFinancialSignals(
        appeared({
          gap: 3,
          date:
            "10.10.2024",
        }),
        [],
      );

    assert.equal(
      result.temporal_precision,
      "reduced_gap",
    );

    assert.equal(
      result.transaction_status,
      "not_inferred",
    );
  },
);
