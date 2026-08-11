import {
  normalizeText,
} from "./utils.js";

export const ASSET_TRANSACTION_SIGNAL_VERSION =
  "asset-transaction-signal-v1";

function positiveNumber(value) {
  const number =
    Number(value);

  return (
    Number.isFinite(number) &&
    number > 0
  )
    ? number
    : null;
}

function round(
  value,
  digits = 2,
) {
  const power =
    10 ** digits;

  return (
    Math.round(
      value * power,
    ) / power
  );
}

function roleOf(fact) {
  return (
    fact?.value_json
      ?.person
      ?.role ??
    null
  );
}

function isDeclarantIncome(
  fact,
) {
  return (
    fact?.fact_type ===
      "income" &&
    roleOf(fact) ===
      "declarant" &&
    String(
      fact?.unit ?? "",
    ).toUpperCase() ===
      "UAH"
  );
}

export function
sumDeclarantIncomeUah(
  facts = [],
) {
  let total = 0;

  for (const fact of facts) {
    if (
      !isDeclarantIncome(
        fact,
      )
    ) {
      continue;
    }

    const amount =
      positiveNumber(
        fact.value_number,
      );

    if (amount) {
      total += amount;
    }
  }

  return round(total);
}

export function
extractDeclaredYear(
  value,
) {
  const matches =
    String(value ?? "")
      .match(
        /(?:19|20)\d{2}/g,
      ) ?? [];

  const years =
    [
      ...new Set(
        matches.map(
          Number,
        ),
      ),
    ];

  return years.length === 1
    ? years[0]
    : null;
}

function incomeText(fact) {
  return normalizeText(
    [
      fact?.value_text,
      fact?.value_json
        ?.income_type,
      fact?.value_json
        ?.other_income_type,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function isDisposalText(
  text,
) {
  return (
    text.includes(
      "відчуж",
    ) ||
    text.includes(
      "продаж",
    )
  );
}

function categoryMatches(
  text,
  assetType,
) {
  if (
    assetType ===
      "vehicle"
  ) {
    return [
      "рухом",
      "транспорт",
      "автомоб",
    ].some(
      (token) =>
        text.includes(token),
    );
  }

  if (
    assetType ===
      "real_estate"
  ) {
    return [
      "нерухом",
      "квартир",
      "будин",
      "земель",
    ].some(
      (token) =>
        text.includes(token),
    );
  }

  return false;
}

function incomeView(fact) {
  return {
    id:
      fact?.id ?? null,

    amount_uah:
      positiveNumber(
        fact?.value_number,
      ),

    income_type:
      fact?.value_json
        ?.income_type ??
      fact?.value_text ??
      null,

    other_income_type:
      fact?.value_json
        ?.other_income_type ??
      null,

    source:
      fact?.value_json
        ?.source ??
      null,

    source_details:
      fact?.value_json
        ?.source_details ??
      null,

    source_document_id:
      fact?.source_document_id ??
      null,
  };
}

export function
findDisposalIncomeCandidates(
  facts = [],
  assetType,
) {
  const specific = [];
  const generic = [];

  for (const fact of facts) {
    if (
      !isDeclarantIncome(
        fact,
      )
    ) {
      continue;
    }

    const text =
      incomeText(fact);

    if (
      !isDisposalText(
        text,
      )
    ) {
      continue;
    }

    if (
      categoryMatches(
        text,
        assetType,
      )
    ) {
      specific.push(
        incomeView(fact),
      );

      continue;
    }

    generic.push(
      incomeView(fact),
    );
  }

  const selected =
    specific.length
      ? specific
      : generic;

  return {
    specific,
    generic,

    selected,

    specificity:
      specific.length
        ? "asset_type"
        : generic.length
          ? "generic"
          : "none",
  };
}


function validateEvent(event) {
  if (
    event?.event_type !==
      "appeared" &&
    event?.event_type !==
      "disappeared"
  ) {
    throw new TypeError(
      "Unsupported asset transition event",
    );
  }

  return event;
}

function temporalPrecision(
  event,
) {
  return (
    Number(
      event?.year_gap,
    ) === 1
  )
    ? "consecutive"
    : "reduced_gap";
}

function acquisitionAssessment(
  event,
  toYearFacts,
) {
  const fact =
    event?.fact ?? {};

  const value =
    fact?.value_json ?? {};

  const cost =
    positiveNumber(
      value.cost,
    );

  const acquisitionYear =
    extractDeclaredYear(
      value.acquisition_date,
    );

  const fromYear =
    Number(
      event.from_year,
    );

  const toYear =
    Number(
      event.to_year,
    );

  const acquisitionInWindow =
    acquisitionYear != null &&
    Number.isSafeInteger(
      fromYear,
    ) &&
    Number.isSafeInteger(
      toYear,
    ) &&
    acquisitionYear >
      fromYear &&
    acquisitionYear <=
      toYear;

  const declaredIncomeUah =
    sumDeclarantIncomeUah(
      toYearFacts,
    );

  const costIncomeRatio =
    cost &&
    declaredIncomeUah > 0
      ? round(
          cost /
            declaredIncomeUah,
          4,
        )
      : null;

  const findings = [];

  if (acquisitionInWindow) {
    findings.push({
      code:
        "declared_acquisition_date",

      strength:
        "supporting",

      acquisition_year:
        acquisitionYear,
    });
  }

  if (cost) {
    findings.push({
      code:
        "declared_acquisition_cost",

      strength:
        "supporting",

      amount_uah:
        cost,
    });
  }

  if (
    costIncomeRatio != null &&
    costIncomeRatio > 1
  ) {
    findings.push({
      code:
        "funding_context_required",

      strength:
        "review",

      cost_income_ratio:
        costIncomeRatio,

      /*
       * Cost greater than annual income
       * is not proof of unexplained funds:
       * savings, loans, gifts, sales and
       * other lawful sources may exist.
       */
    });
  }

  let financialStatus =
    "insufficient";

  if (
    acquisitionInWindow &&
    cost
  ) {
    financialStatus =
      "acquisition_supported";
  } else if (
    acquisitionInWindow ||
    cost
  ) {
    financialStatus =
      "partial_acquisition_signal";
  }

  return {
    financial_status:
      financialStatus,

    transaction_status:
      "not_inferred",

    declared_income_uah:
      declaredIncomeUah,

    acquisition: {
      acquisition_date:
        value.acquisition_date ??
        null,

      acquisition_year:
        acquisitionYear,

      acquisition_in_transition_window:
        acquisitionInWindow,

      declared_cost_uah:
        cost,

      cost_income_ratio:
        costIncomeRatio,
    },

    disposal: null,

    findings,
  };
}

function disposalAssessment(
  event,
  toYearFacts,
) {
  const candidates =
    findDisposalIncomeCandidates(
      toYearFacts,
      event.asset_type,
    );

  const count =
    candidates
      .selected
      .length;

  let financialStatus =
    "no_disposal_income_signal";

  if (count === 1) {
    financialStatus =
      candidates.specificity ===
        "asset_type"
        ? "disposal_income_candidate"
        : "generic_disposal_income_candidate";
  }

  if (count > 1) {
    financialStatus =
      "ambiguous_disposal_income";
  }

  const findings = [];

  if (count === 1) {
    findings.push({
      code:
        candidates.specificity ===
          "asset_type"
          ? "asset_type_disposal_income"
          : "generic_disposal_income",

      strength:
        "supporting",

      candidate:
        candidates.selected[0],
    });
  }

  if (count > 1) {
    findings.push({
      code:
        "multiple_disposal_income_candidates",

      strength:
        "ambiguous",

      candidates:
        candidates.selected,
    });
  }

  return {
    financial_status:
      financialStatus,

    transaction_status:
      "not_inferred",

    declared_income_uah:
      sumDeclarantIncomeUah(
        toYearFacts,
      ),

    acquisition: null,

    disposal: {
      specificity:
        candidates.specificity,

      candidates:
        candidates.selected,

      candidate_count:
        count,
    },

    findings,
  };
}

export function
assessAssetTransitionFinancialSignals(
  event,
  toYearFacts = [],
) {
  validateEvent(event);

  const assessment =
    event.event_type ===
      "appeared"
      ? acquisitionAssessment(
          event,
          toYearFacts,
        )
      : disposalAssessment(
          event,
          toYearFacts,
        );

  return {
    version:
      ASSET_TRANSACTION_SIGNAL_VERSION,

    event_type:
      event.event_type,

    asset_type:
      event.asset_type ??
      null,

    asset_key:
      event.asset_key ??
      null,

    from_year:
      event.from_year ??
      null,

    to_year:
      event.to_year ??
      null,

    temporal_precision:
      temporalPrecision(
        event,
      ),

    ...assessment,
  };
}

export function
assessAssetTransitionSet({
  transition,
  toYearFacts = [],
} = {}) {
  const appeared =
    (
      transition?.appeared ??
      []
    ).map(
      (event) =>
        assessAssetTransitionFinancialSignals(
          event,
          toYearFacts,
        ),
    );

  const disappeared =
    (
      transition?.disappeared ??
      []
    ).map(
      (event) =>
        assessAssetTransitionFinancialSignals(
          event,
          toYearFacts,
        ),
    );

  return {
    version:
      ASSET_TRANSACTION_SIGNAL_VERSION,

    from_year:
      transition?.from_year ??
      null,

    to_year:
      transition?.to_year ??
      null,

    appeared,
    disappeared,

    summary: {
      appeared:
        appeared.length,

      disappeared:
        disappeared.length,

      acquisition_supported:
        appeared.filter(
          (item) =>
            item.financial_status ===
              "acquisition_supported",
        ).length,

      disposal_candidates:
        disappeared.filter(
          (item) =>
            item.financial_status ===
              "disposal_income_candidate" ||
            item.financial_status ===
              "generic_disposal_income_candidate",
        ).length,

      ambiguous_disposals:
        disappeared.filter(
          (item) =>
            item.financial_status ===
              "ambiguous_disposal_income",
        ).length,
    },
  };
}
