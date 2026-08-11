import { loadDeclarationYears, loadDeterministicDeclarationContext } from "./declaration-context.js";

import {
  loadDeterministicIncomeAnalyticsContext,
  loadDeterministicMultiYearIncomeAnalyticsContext,
  loadDeterministicIncomeContext,
} from "./income-context.js";

import {
  loadDeterministicCashContext,
} from "./cash-context.js";

import {
  loadDeterministicRealEstateContext,
} from "./real-estate-context.js";


import {
  loadDeterministicVehicleContext,
} from "./vehicle-context.js";


import {
  loadDeterministicEmploymentContext,
} from "./employment-context.js";


import {
  loadDeterministicFamilyContext,
} from "./family-context.js";


import {
  loadDeterministicRelationsContext,
} from "./relations-context.js";

import {
  getSubject,
  listMentions,
} from "./store.js";

import {
  loadReportSourceDocuments,
} from "./source-documents-context.js";

export const REPORT_MODEL_SCHEMA_VERSION =
  "report-model-v1";

export const REPORT_ANALYTICS_VERSION =
  "report-analytics-v1";

export const REPORT_RULES_VERSION =
  "report-rules-v1";

export const REPORT_MODEL_LIMITATIONS = [
  "Відкриті джерела можуть бути неповними.",
  "Відсутність запису не доводить відсутність факту.",
  "Identity match може потребувати ручної перевірки.",
  "Евристичні сигнали не є юридичним висновком.",
];

function isoTimestamp(value) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new TypeError(
      "Invalid generatedAt",
    );
  }

  return date.toISOString();
}

function subjectSection(subject) {
  return {
    subject_id:
      subject?.id ?? null,

    entity_id:
      subject?.entity_id ?? null,

    full_name:
      subject?.full_name ?? null,

    organization:
      subject?.organization ?? null,

    position:
      subject?.position ?? null,

    city:
      subject?.city ?? null,

    status:
      subject?.status ?? null,
  };
}

function normalizeYears(values = []) {
  return Array.isArray(values)
    ? [...new Set(values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "").map(Number).filter(Number.isInteger))].sort((a, b) => b - a)
    : [];
}

function cleanValue(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function buildDeclarationSection({
  availableYears = [],
  contexts = [],
} = {}) {
  const items = [];
  const seen = new Set();

  for (const context of contexts.filter(Boolean)) {
    const canonicalId =
      context?.analytics?.yearly?.[0]?.sourceDocumentId ?? null;

    for (const fact of context.facts ?? []) {
      if (fact?.fact_type !== "declaration_submission") continue;

      const value = fact.value_json ?? {};
      const year = Number(
        value.declaration_year ??
        fact?.metadata?.declaration_year,
      );
      if (!Number.isInteger(year)) continue;

      const sourceId = fact.source_document_id ?? null;
      const source =
        (context.source_documents ?? []).find(
          (item) => String(item?.id ?? "") === String(sourceId ?? ""),
        );
      const url =
        cleanValue(value.url) ??
        cleanValue(source?.url);
      const guid = cleanValue(value.document_guid);
      const key = `${year}:${guid ?? url ?? sourceId ?? fact.id ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        year,
        source_document_id: sourceId,
        document_guid: guid,
        registry: cleanValue(value.registry),
        published_at: cleanValue(value.published_at),
        source_url: url,
        canonical:
          canonicalId !== null &&
          sourceId !== null &&
          String(canonicalId) === String(sourceId),
        evidence:
          sourceId !== null || url
            ? [{
                source_document_id: sourceId,
                provider: null,
                url,
                observed_at: null,
              }]
            : [],
      });
    }
  }

  items.sort((a, b) =>
    b.year - a.year ||
    String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""))
  );

  return {
    available_years: normalizeYears(availableYears),
    items,
  };
}

function numericValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function round2(value) {
  return Math.round(
    Number(value) * 100,
  ) / 100;
}

function safeIncomeSourceDetails(
  value,
) {
  const details =
    value &&
    typeof value === "object"
      ? value
      : {};

  return {
    source_type:
      cleanValue(
        details.source_type,
      ),

    company_name:
      cleanValue(
        details.company_name,
      ),

    edrpou:
      cleanValue(
        details.edrpou,
      ),

    foreign_company_name:
      cleanValue(
        details.foreign_company_name,
      ),

    foreign_company_code:
      cleanValue(
        details.foreign_company_code,
      ),

    person_name:
      cleanValue(
        details.person_name,
      ),
  };
}

export function buildIncomeSection({
  context = null,
  detailContexts = [],
} = {}) {
  const yearly = [];

  const sourceDocuments =
    Array.isArray(
      context?.source_documents,
    )
      ? context.source_documents
      : [];

  for (
    const item of
    context?.analytics?.yearly ?? []
  ) {
    const year =
      numericValue(item?.year);

    if (!Number.isInteger(year)) {
      continue;
    }

    const declarantUah =
      numericValue(
        item?.incomeDeclarantUah,
      );

    const householdUah =
      numericValue(
        item?.incomeHouseholdUah,
      );

    const familyUah =
      declarantUah !== null &&
      householdUah !== null
        ? round2(
            householdUah -
            declarantUah,
          )
        : null;

    const sourceDocumentId =
      item?.sourceDocumentId ??
      null;

    const source =
      sourceDocuments.find(
        (candidate) =>
          String(
            candidate?.id ?? "",
          ) ===
          String(
            sourceDocumentId ?? "",
          ),
      );

    const sourceUrl =
      cleanValue(
        source?.url,
      );

    yearly.push({
      year,

      declarant_uah:
        declarantUah,

      family_uah:
        familyUah,

      household_uah:
        householdUah,

      source_document_id:
        sourceDocumentId,

      statement_type:
        "calculation",

      evidence:
        sourceDocumentId !== null ||
        sourceUrl
          ? [{
              source_document_id:
                sourceDocumentId,

              provider: null,

              url:
                sourceUrl,

              observed_at:
                null,

              statement_type:
                "calculation",
            }]
          : [],
    });
  }

  yearly.sort(
    (a, b) =>
      b.year - a.year,
  );

  const sources = [];

  for (
    const detailContext of
    (
      Array.isArray(detailContexts)
        ? detailContexts
        : []
    ).filter(Boolean)
  ) {
    const detectedYear =
      normalizeYears(
        detailContext
          ?.detected_years,
      )[0] ?? null;

    const sourceDocuments =
      Array.isArray(
        detailContext
          ?.source_documents,
      )
        ? detailContext
            .source_documents
        : [];

    for (
      const fact of
      detailContext?.facts ?? []
    ) {
      if (
        fact?.fact_type !==
        "income"
      ) {
        continue;
      }

      const value =
        fact.value_json ?? {};

      const year =
        numericValue(
          fact
            ?.metadata
            ?.declaration_year ??
          detectedYear,
        );

      if (
        !Number.isInteger(year)
      ) {
        continue;
      }

      const person =
        value.person &&
        typeof value.person ===
          "object"
          ? value.person
          : {};

      const sourceDocumentId =
        fact.source_document_id ??
        null;

      const sourceDocument =
        sourceDocuments.find(
          (candidate) =>
            String(
              candidate?.id ?? "",
            ) ===
            String(
              sourceDocumentId ??
              "",
            ),
        );

      const sourceUrl =
        cleanValue(
          sourceDocument?.url,
        );

      sources.push({
        year,

        recipient_role:
          cleanValue(
            person.role,
          ),

        recipient_name:
          cleanValue(
            person.name,
          ),

        recipient_relationship:
          cleanValue(
            person.relationship ??
            person.relation,
          ),

        income_type:
          cleanValue(
            value.income_type ??
            fact.value_text,
          ),

        other_income_type:
          cleanValue(
            value.other_income_type,
          ),

        amount:
          numericValue(
            value.amount ??
            fact.value_number,
          ),

        currency:
          cleanValue(
            fact.unit ??
            value.currency,
          ),

        source:
          cleanValue(
            value.source,
          ),

        source_details:
          safeIncomeSourceDetails(
            value.source_details,
          ),

        source_document_id:
          sourceDocumentId,

        statement_type:
          "source_fact",

        evidence:
          sourceDocumentId !== null ||
          sourceUrl
            ? [{
                source_document_id:
                  sourceDocumentId,

                provider: null,

                url:
                  sourceUrl,

                observed_at:
                  null,

                statement_type:
                  "source_fact",
              }]
            : [],
      });
    }
  }

  sources.sort(
    (a, b) =>
      b.year - a.year ||
      (
        b.amount ?? -Infinity
      ) -
      (
        a.amount ?? -Infinity
      ) ||
      String(
        a.source ?? "",
      ).localeCompare(
        String(
          b.source ?? "",
        ),
      ),
  );

  return {
    yearly,
    sources,
  };
}

function normalizeCurrency(
  value,
) {
  const raw =
    cleanValue(value);

  if (!raw) {
    return null;
  }

  const upper =
    raw.toUpperCase();

  if (/^UAH(?:\s|\(|$)/.test(upper)) {
    return "UAH";
  }

  if (/^USD(?:\s|\(|$)/.test(upper)) {
    return "USD";
  }

  if (/^EUR(?:\s|\(|$)/.test(upper)) {
    return "EUR";
  }

  return upper;
}

function safeAssetRight(
  right,
) {
  const actor =
    right?.actor &&
    typeof right.actor === "object"
      ? right.actor
      : {};

  return {
    role:
      cleanValue(
        actor.role,
      ),

    name:
      cleanValue(
        actor.name,
      ),

    relation:
      cleanValue(
        actor.relationship ??
        actor.relation,
      ),

    ownership_type:
      cleanValue(
        right?.ownership_type,
      ),

    other_ownership:
      cleanValue(
        right?.other_ownership,
      ),

    share_percent:
      numericValue(
        right?.share_percent,
      ),

    third_party_kind:
      cleanValue(
        right?.third_party_kind,
      ),

    third_party_name:
      cleanValue(
        right?.third_party_name,
      ),

    third_party_edrpou:
      cleanValue(
        right?.third_party_edrpou,
      ),

    third_party_foreign_code:
      cleanValue(
        right?.third_party_foreign_code,
      ),
  };
}

function cashItemRoles(
  value,
) {
  const roles =
    new Set();

  const directRole =
    cleanValue(
      value?.person?.role,
    );

  if (directRole) {
    roles.add(
      directRole,
    );
  }

  for (
    const right of
    Array.isArray(value?.rights)
      ? value.rights
      : []
  ) {
    const role =
      cleanValue(
        right
          ?.actor
          ?.role,
      );

    if (role) {
      roles.add(
        role,
      );
    }
  }

  return roles;
}

function addCurrencyAmount(
  target,
  currency,
  amount,
) {
  if (
    !currency ||
    amount === null
  ) {
    return;
  }

  target[currency] =
    round2(
      (
        target[currency] ??
        0
      ) +
      amount,
    );
}

export function buildCashAssetsSection({
  contexts = [],
} = {}) {
  const yearlyMap =
    new Map();

  for (
    const context of
    (
      Array.isArray(contexts)
        ? contexts
        : []
    ).filter(Boolean)
  ) {
    const detectedYear =
      normalizeYears(
        context
          ?.detected_years,
      )[0] ?? null;

    const canonicalSourceId =
      context
        ?.analytics
        ?.yearly
        ?.[0]
        ?.sourceDocumentId ??
      null;

    const sourceDocument =
      (
        context
          ?.source_documents ??
        []
      ).find(
        (candidate) =>
          String(
            candidate?.id ?? "",
          ) ===
          String(
            canonicalSourceId ??
            "",
          ),
      );

    const sourceUrl =
      cleanValue(
        sourceDocument?.url,
      );

    for (
      const fact of
      context?.facts ?? []
    ) {
      if (
        fact?.fact_type !==
        "cash_asset"
      ) {
        continue;
      }

      const value =
        fact.value_json ?? {};

      const year =
        numericValue(
          fact
            ?.metadata
            ?.declaration_year ??
          detectedYear,
        );

      if (
        !Number.isInteger(year)
      ) {
        continue;
      }

      if (!yearlyMap.has(year)) {
        yearlyMap.set(
          year,
          {
            year,

            declarant_by_currency:
              {},

            household_by_currency:
              {},

            items: [],

            evidence:
              canonicalSourceId !== null ||
              sourceUrl
                ? [{
                    source_document_id:
                      canonicalSourceId,

                    provider:
                      null,

                    url:
                      sourceUrl,

                    observed_at:
                      null,

                    statement_type:
                      "calculation",
                  }]
                : [],
          },
        );
      }

      const yearItem =
        yearlyMap.get(year);

      const amount =
        numericValue(
          value.amount ??
          fact.value_number,
        );

      const currencyRaw =
        cleanValue(
          value.currency ??
          fact.unit,
        );

      const currency =
        normalizeCurrency(
          currencyRaw,
        );

      const roles =
        cashItemRoles(
          value,
        );

      if (
        roles.has(
          "declarant",
        )
      ) {
        addCurrencyAmount(
          yearItem
            .declarant_by_currency,
          currency,
          amount,
        );
      }

      if (
        roles.has(
          "declarant",
        ) ||
        roles.has(
          "family",
        )
      ) {
        addCurrencyAmount(
          yearItem
            .household_by_currency,
          currency,
          amount,
        );
      }

      const person =
        value.person &&
        typeof value.person ===
          "object"
          ? value.person
          : {};

      const sourceDocumentId =
        fact.source_document_id ??
        canonicalSourceId ??
        null;

      yearItem.items.push({
        asset_type:
          cleanValue(
            value.asset_type ??
            fact.value_text,
          ),

        other_asset_type:
          cleanValue(
            value.other_asset_type,
          ),

        amount,

        currency,

        currency_raw:
          currencyRaw,

        organization_type:
          cleanValue(
            value.organization_type,
          ),

        organization_name:
          cleanValue(
            value.organization_name,
          ),

        owner_role:
          cleanValue(
            person.role,
          ),

        owner_name:
          cleanValue(
            person.name,
          ),

        owner_relationship:
          cleanValue(
            person.relationship ??
            person.relation,
          ),

        rights:
          (
            Array.isArray(
              value.rights,
            )
              ? value.rights
              : []
          ).map(
            safeAssetRight,
          ),

        source_document_id:
          sourceDocumentId,

        statement_type:
          "source_fact",

        evidence:
          sourceDocumentId !== null ||
          sourceUrl
            ? [{
                source_document_id:
                  sourceDocumentId,

                provider:
                  null,

                url:
                  sourceUrl,

                observed_at:
                  null,

                statement_type:
                  "source_fact",
              }]
            : [],
      });
    }
  }

  const yearly =
    [
      ...yearlyMap.values(),
    ];

  for (const item of yearly) {
    item.items.sort(
      (a, b) =>
        (
          b.amount ??
          -Infinity
        ) -
        (
          a.amount ??
          -Infinity
        ),
    );
  }

  yearly.sort(
    (a, b) =>
      b.year - a.year,
  );

  return {
    yearly,
  };
}

export function buildRealEstateSection({
  contexts = [],
} = {}) {
  const yearlyMap =
    new Map();

  for (
    const context of
    (
      Array.isArray(contexts)
        ? contexts
        : []
    ).filter(Boolean)
  ) {
    const detectedYear =
      normalizeYears(
        context
          ?.detected_years,
      )[0] ?? null;

    const canonicalSourceId =
      context
        ?.analytics
        ?.yearly
        ?.[0]
        ?.sourceDocumentId ??
      null;

    const sourceDocument =
      (
        context
          ?.source_documents ??
        []
      ).find(
        (candidate) =>
          String(
            candidate?.id ?? "",
          ) ===
          String(
            canonicalSourceId ??
            "",
          ),
      );

    const sourceUrl =
      cleanValue(
        sourceDocument?.url,
      );

    for (
      const fact of
      context?.facts ?? []
    ) {
      if (
        fact?.fact_type !==
        "real_estate"
      ) {
        continue;
      }

      const value =
        fact.value_json ?? {};

      const year =
        numericValue(
          fact
            ?.metadata
            ?.declaration_year ??
          detectedYear,
        );

      if (
        !Number.isInteger(year)
      ) {
        continue;
      }

      if (!yearlyMap.has(year)) {
        yearlyMap.set(
          year,
          {
            year,

            items: [],

            evidence:
              canonicalSourceId !== null ||
              sourceUrl
                ? [{
                    source_document_id:
                      canonicalSourceId,

                    provider:
                      null,

                    url:
                      sourceUrl,

                    observed_at:
                      null,

                    statement_type:
                      "source_fact",
                  }]
                : [],
          },
        );
      }

      const objectType =
        cleanValue(
          value.object_type ??
          fact.value_text,
        );

      const area =
        numericValue(
          value.total_area ??
          fact.value_number,
        );

      const acquisitionDate =
        cleanValue(
          value.acquisition_date,
        );

      const location = {
        country:
          cleanValue(
            value.country,
          ),

        region:
          cleanValue(
            value.region,
          ),

        district:
          cleanValue(
            value.district,
          ),

        city:
          cleanValue(
            value.city,
          ),
      };

      const person =
        value.person &&
        typeof value.person ===
          "object"
          ? value.person
          : {};

      const sourceDocumentId =
        fact.source_document_id ??
        canonicalSourceId ??
        null;

      const sourceItemRef =
        cleanValue(
          fact
            ?.metadata
            ?.item_ref,
        );

      yearlyMap
        .get(year)
        .items
        .push({
          object_type:
            objectType,

          other_object_type:
            cleanValue(
              value.other_object_type,
            ),

          area,

          area_unit:
            cleanValue(
              fact.unit,
            ),

          location,

          acquisition_date:
            acquisitionDate,

          cost:
            numericValue(
              value.cost,
            ),

          owner_role:
            cleanValue(
              person.role,
            ),

          owner_name:
            cleanValue(
              person.name,
            ),

          owner_relationship:
            cleanValue(
              person.relationship ??
              person.relation,
            ),

          rights:
            (
              Array.isArray(
                value.rights,
              )
                ? value.rights
                : []
            ).map(
              safeAssetRight,
            ),

          tracking_identity: {
            source_system:
              "nazk",

            source_item_ref:
              sourceItemRef,

            signature: {
              object_type:
                objectType,

              area,

              country:
                location.country,

              region:
                location.region,

              district:
                location.district,

              city:
                location.city,

              acquisition_date:
                acquisitionDate,
            },
          },

          source_document_id:
            sourceDocumentId,

          statement_type:
            "source_fact",

          evidence:
            sourceDocumentId !== null ||
            sourceUrl
              ? [{
                  source_document_id:
                    sourceDocumentId,

                  provider:
                    null,

                  url:
                    sourceUrl,

                  observed_at:
                    null,

                  statement_type:
                    "source_fact",
                }]
              : [],
        });
    }
  }

  const yearly =
    [
      ...yearlyMap.values(),
    ];

  for (const item of yearly) {
    item.items.sort(
      (a, b) =>
        String(
          a.object_type ?? "",
        ).localeCompare(
          String(
            b.object_type ?? "",
          ),
          "uk",
        ) ||
        (
          b.area ??
          -Infinity
        ) -
        (
          a.area ??
          -Infinity
        ),
    );
  }

  yearly.sort(
    (a, b) =>
      b.year - a.year,
  );

  return {
    yearly,
  };
}

export function buildVehicleSection({
  contexts = [],
} = {}) {
  const yearlyMap =
    new Map();

  for (
    const context of
    (
      Array.isArray(contexts)
        ? contexts
        : []
    ).filter(Boolean)
  ) {
    const detectedYear =
      normalizeYears(
        context
          ?.detected_years,
      )[0] ?? null;

    const canonicalSourceId =
      context
        ?.analytics
        ?.yearly
        ?.[0]
        ?.sourceDocumentId ??
      null;

    const sourceDocument =
      (
        context
          ?.source_documents ??
        []
      ).find(
        (candidate) =>
          String(
            candidate?.id ?? "",
          ) ===
          String(
            canonicalSourceId ??
            "",
          ),
      );

    const sourceUrl =
      cleanValue(
        sourceDocument?.url,
      );

    for (
      const fact of
      context?.facts ?? []
    ) {
      if (
        fact?.fact_type !==
        "vehicle"
      ) {
        continue;
      }

      const value =
        fact.value_json ?? {};

      const year =
        numericValue(
          fact
            ?.metadata
            ?.declaration_year ??
          detectedYear,
        );

      if (
        !Number.isInteger(year)
      ) {
        continue;
      }

      if (!yearlyMap.has(year)) {
        yearlyMap.set(
          year,
          {
            year,
            items: [],
            evidence:
              canonicalSourceId !== null ||
              sourceUrl
                ? [{
                    source_document_id:
                      canonicalSourceId,
                    provider:
                      null,
                    url:
                      sourceUrl,
                    observed_at:
                      null,
                    statement_type:
                      "source_fact",
                  }]
                : [],
          },
        );
      }

      const person =
        value.person &&
        typeof value.person ===
          "object"
          ? value.person
          : {};

      const brand =
        cleanValue(
          value.brand,
        );

      const model =
        cleanValue(
          value.model,
        );

      const productionYear =
        numericValue(
          value.production_year,
        );

      const acquisitionDate =
        cleanValue(
          value.acquisition_date,
        );

      const sourceDocumentId =
        fact.source_document_id ??
        canonicalSourceId ??
        null;

      const sourceItemRef =
        cleanValue(
          fact
            ?.metadata
            ?.item_ref,
        );

      yearlyMap
        .get(year)
        .items
        .push({
          object_type:
            cleanValue(
              value.object_type ??
              fact.value_text,
            ),

          other_object_type:
            cleanValue(
              value.other_object_type,
            ),

          brand,

          model,

          production_year:
            productionYear,

          acquisition_date:
            acquisitionDate,

          cost:
            numericValue(
              value.cost,
            ),

          owner_role:
            cleanValue(
              person.role,
            ),

          owner_name:
            cleanValue(
              person.name,
            ),

          owner_relationship:
            cleanValue(
              person.relationship ??
              person.relation,
            ),

          rights:
            (
              Array.isArray(
                value.rights,
              )
                ? value.rights
                : []
            ).map(
              safeAssetRight,
            ),

          tracking_identity: {
            source_system:
              "nazk",

            source_item_ref:
              sourceItemRef,

            signature: {
              brand,
              model,

              production_year:
                productionYear,

              acquisition_date:
                acquisitionDate,
            },
          },

          source_document_id:
            sourceDocumentId,

          statement_type:
            "source_fact",

          evidence:
            sourceDocumentId !== null ||
            sourceUrl
              ? [{
                  source_document_id:
                    sourceDocumentId,
                  provider:
                    null,
                  url:
                    sourceUrl,
                  observed_at:
                    null,
                  statement_type:
                    "source_fact",
                }]
              : [],
        });
    }
  }

  const yearly =
    [...yearlyMap.values()];

  for (const item of yearly) {
    item.items.sort(
      (a, b) =>
        String(
          a.brand ?? "",
        ).localeCompare(
          String(
            b.brand ?? "",
          ),
        ) ||
        String(
          a.model ?? "",
        ).localeCompare(
          String(
            b.model ?? "",
          ),
        ),
    );
  }

  yearly.sort(
    (a, b) =>
      b.year - a.year,
  );

  return {
    yearly,
  };
}

function normalizeCareerText(value) {
  const text =
    cleanValue(value);

  if (!text) {
    return null;
  }

  return text
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}


export function buildCareerSection({
  contexts = [],
} = {}) {
  const items = [];

  for (
    const context of
    (
      Array.isArray(contexts)
        ? contexts
        : []
    ).filter(Boolean)
  ) {
    const detectedYear =
      normalizeYears(
        context?.detected_years,
      )[0] ?? null;

    const canonicalSourceId =
      context?.analytics?.yearly
        ?.[0]?.sourceDocumentId ??
      null;

    const sourceDocument =
      (
        context?.source_documents ??
        []
      ).find(
        (item) =>
          String(item?.id ?? "") ===
          String(canonicalSourceId ?? ""),
      );

    const sourceUrl =
      cleanValue(
        sourceDocument?.url,
      );

    for (
      const fact of
      context?.facts ?? []
    ) {
      if (
        fact?.fact_type !==
        "employment"
      ) {
        continue;
      }

      const value =
        fact.value_json ?? {};

      if (
        value?.person?.role !==
        "declarant"
      ) {
        continue;
      }

      const year =
        Number(
          fact?.metadata
            ?.declaration_year ??
          detectedYear,
        );

      if (!Number.isInteger(year)) {
        continue;
      }

      const sourceDocumentId =
        fact.source_document_id ??
        canonicalSourceId ??
        null;

      items.push({
        year,

        organization:
          cleanValue(
            value.workplace,
          ),

        position:
          cleanValue(
            value.position ??
            fact.value_text,
          ),

        source_document_id:
          sourceDocumentId,

        statement_type:
          "source_fact",

        evidence:
          sourceDocumentId !== null ||
          sourceUrl
            ? [{
                source_document_id:
                  sourceDocumentId,
                provider:
                  null,
                url:
                  sourceUrl,
                observed_at:
                  null,
                statement_type:
                  "source_fact",
              }]
            : [],
      });
    }
  }

  items.sort(
    (a, b) =>
      b.year - a.year,
  );

  const chronological =
    [...items].sort(
      (a, b) =>
        a.year - b.year,
    );

  const transitions = [];

  for (
    let index = 1;
    index < chronological.length;
    index += 1
  ) {
    const previous =
      chronological[index - 1];

    const current =
      chronological[index];

    if (
      current.year -
      previous.year !==
      1
    ) {
      continue;
    }

    const previousOrganization =
      normalizeCareerText(
        previous.organization,
      );

    const currentOrganization =
      normalizeCareerText(
        current.organization,
      );

    const previousPosition =
      normalizeCareerText(
        previous.position,
      );

    const currentPosition =
      normalizeCareerText(
        current.position,
      );

    transitions.push({
      from_year:
        previous.year,

      to_year:
        current.year,

      organization_changed:
        previousOrganization &&
        currentOrganization
          ? previousOrganization !==
            currentOrganization
          : null,

      position_changed:
        previousPosition &&
        currentPosition
          ? previousPosition !==
            currentPosition
          : null,

      statement_type:
        "calculation",

      evidence: [
        ...(previous.evidence ?? []),
        ...(current.evidence ?? []),
      ],
    });
  }

  return {
    items,
    transitions,
  };
}


export function buildRelatedPeopleSection({
  familyContexts = [],
} = {}) {
  const items = [];

  for (
    const context of
    (
      Array.isArray(familyContexts)
        ? familyContexts
        : []
    ).filter(Boolean)
  ) {
    const detectedYear =
      normalizeYears(
        context?.detected_years,
      )[0] ?? null;

    const canonicalSourceId =
      context?.analytics?.yearly
        ?.[0]?.sourceDocumentId ??
      null;

    const sourceDocument =
      (
        context?.source_documents ??
        []
      ).find(
        (item) =>
          String(item?.id ?? "") ===
          String(canonicalSourceId ?? ""),
      );

    const sourceUrl =
      cleanValue(
        sourceDocument?.url,
      );

    for (
      const fact of
      context?.facts ?? []
    ) {
      if (
        fact?.fact_type !==
        "family_member"
      ) {
        continue;
      }

      const value =
        fact.value_json ?? {};

      const year =
        Number(
          fact?.metadata
            ?.declaration_year ??
          detectedYear,
        );

      if (!Number.isInteger(year)) {
        continue;
      }

      const fullName =
        cleanValue(
          value.name ??
          fact.value_text,
        );

      if (!fullName) {
        continue;
      }

      const sourceDocumentId =
        fact.source_document_id ??
        canonicalSourceId ??
        null;

      items.push({
        entity_id:
          null,

        full_name:
          fullName,

        relation_type:
          "family_member",

        role:
          "family",

        relationship:
          cleanValue(
            value.relation,
          ),

        years: [
          year,
        ],

        identity_status:
          "source_observation",

        review_required:
          true,

        source_identity: {
          source_system:
            "nazk",

          source_person_ref:
            cleanValue(
              value.person_ref,
            ),
        },

        statement_type:
          "source_fact",

        evidence:
          sourceDocumentId !== null ||
          sourceUrl
            ? [{
                source_document_id:
                  sourceDocumentId,
                provider:
                  null,
                url:
                  sourceUrl,
                observed_at:
                  null,
                statement_type:
                  "source_fact",
              }]
            : [],
      });
    }
  }

  items.sort(
    (a, b) =>
      Number(
        b.years?.[0] ?? 0,
      ) -
      Number(
        a.years?.[0] ?? 0,
      ) ||
      String(
        a.full_name ?? "",
      ).localeCompare(
        String(
          b.full_name ?? "",
        ),
        "uk",
      ),
  );

  return {
    items,
  };
}


const REPORT_RELATION_LABELS = {
  employed_by:
    "Місце роботи",

  declared_asset:
    "Задекларований об’єкт",

  income_from:
    "Джерело доходу",

  family_member_observed:
    "Член сім’ї",

  third_party_rightsholder:
    "Третя сторона / правовласник",

  resolved_to:
    "Ідентифіковано як",
};


function safeReportEntityMetadata(value) {
  const source =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  const allowed = [
    "asset_kind",
    "object_type",
    "other_object_type",
    "country",
    "region",
    "district",
    "city",
    "area",
    "acquisition_date",
    "brand",
    "model",
    "production_year",
    "edrpou",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) =>
          source[key] !== null &&
          source[key] !== undefined,
      )
      .map(
        (key) => [
          key,
          source[key],
        ],
      ),
  );
}


function safeReportRelationMetadata(value) {
  const source =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  const allowed = [
    "declaration_year",
    "asset_kind",
    "relation",
    "workplace",
    "position",
    "organization_name",
    "organization_edrpou",
    "total_income_uah",
    "evidence_count",
    "relation_semantics",
    "third_party_kind",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) =>
          source[key] !== null &&
          source[key] !== undefined,
      )
      .map(
        (key) => [
          key,
          source[key],
        ],
      ),
  );
}


export function buildRelationsSection({
  contexts = [],
} = {}) {
  const items = [];

  for (
    const context of
    (
      Array.isArray(contexts)
        ? contexts
        : []
    ).filter(Boolean)
  ) {
    const year =
      normalizeYears(
        context?.detected_years,
      )[0] ?? null;

    if (!Number.isInteger(year)) {
      continue;
    }

    const canonicalSourceId =
      context?.analytics?.yearly
        ?.[0]?.sourceDocumentId ??
      null;

    const sourceDocument =
      (
        context?.source_documents ??
        []
      ).find(
        (document) =>
          String(
            document?.id ?? "",
          ) ===
          String(
            canonicalSourceId ?? "",
          ),
      );

    const sourceUrl =
      cleanValue(
        sourceDocument?.url,
      );

    for (
      const relation of
      context?.relations ?? []
    ) {
      const relationId =
        cleanValue(
          relation?.id,
        );

      const relationType =
        cleanValue(
          relation?.relation_type,
        );

      const fromEntityId =
        cleanValue(
          relation?.from_entity_id,
        );

      const toEntityId =
        cleanValue(
          relation?.to_entity_id,
        );

      if (
        !relationId ||
        !relationType ||
        !fromEntityId ||
        !toEntityId
      ) {
        continue;
      }

      const sourceDocumentId =
        relation.source_document_id ??
        canonicalSourceId ??
        null;

      items.push({
        relation_id:
          relationId,

        relation_type:
          relationType,

        relation_scope:
          cleanValue(
            relation.relation_scope,
          ),

        from_entity_id:
          fromEntityId,

        to_entity_id:
          toEntityId,

        from_entity_type:
          cleanValue(
            relation.from_entity_type,
          ),

        from_name:
          cleanValue(
            relation.from_name,
          ),

        from_metadata:
          safeReportEntityMetadata(
            relation.from_metadata,
          ),

        to_entity_type:
          cleanValue(
            relation.to_entity_type,
          ),

        to_name:
          cleanValue(
            relation.to_name,
          ),

        to_metadata:
          safeReportEntityMetadata(
            relation.to_metadata,
          ),

        label:
          REPORT_RELATION_LABELS[
            relationType
          ] ??
          relationType,

        year,

        confidence:
          null,

        verification_status:
          null,

        metadata:
          safeReportRelationMetadata(
            relation.metadata,
          ),

        statement_type:
          "source_fact",

        evidence:
          sourceDocumentId !== null ||
          sourceUrl
            ? [{
                source_document_id:
                  sourceDocumentId,

                provider:
                  null,

                url:
                  sourceUrl,

                observed_at:
                  null,

                statement_type:
                  "source_fact",
              }]
            : [],
      });
    }
  }

  items.sort(
    (a, b) =>
      b.year - a.year ||
      String(
        a.relation_type,
      ).localeCompare(
        String(
          b.relation_type,
        ),
      ) ||
      String(
        a.relation_id,
      ).localeCompare(
        String(
          b.relation_id,
        ),
      ),
  );

  const counts = {};

  for (const item of items) {
    counts[item.relation_type] =
      (
        counts[
          item.relation_type
        ] ?? 0
      ) + 1;
  }

  return {
    items,
    counts,
  };
}


function isReportPersonType(value) {
  return (
    value === "person" ||
    value === "person_observation"
  );
}


export function buildThirdPartyPeopleSection({
  relations = null,
  analytics = null,
} = {}) {
  const items = [];

  const relationItems =
    Array.isArray(
      relations?.items,
    )
      ? relations.items
      : [];

  for (const relation of relationItems) {
    if (
      relation?.relation_type !==
      "third_party_rightsholder"
    ) {
      continue;
    }

    for (
      const side of
      ["from", "to"]
    ) {
      const entityType =
        relation[
          `${side}_entity_type`
        ];

      if (
        !isReportPersonType(
          entityType,
        )
      ) {
        continue;
      }

      const fullName =
        cleanValue(
          relation[
            `${side}_name`
          ],
        );

      if (!fullName) {
        continue;
      }

      items.push({
        entity_id:
          null,

        full_name:
          fullName,

        relation_type:
          "third_party_rightsholder",

        role:
          "third_party",

        relationship:
          cleanValue(
            relation
              ?.metadata
              ?.relation,
          ),

        years: [
          relation.year,
        ],

        identity_status:
          "source_observation",

        review_required:
          true,

        source_identity: {
          source_system:
            "nazk",

          source_person_ref:
            null,
        },

        statement_type:
          "source_fact",

        evidence:
          Array.isArray(
            relation.evidence,
          )
            ? relation.evidence
            : [],
      });
    }
  }

  items.sort(
    (a, b) =>
      Number(
        b.years?.[0] ?? 0,
      ) -
      Number(
        a.years?.[0] ?? 0,
      ) ||
      String(
        a.full_name ?? "",
      ).localeCompare(
        String(
          b.full_name ?? "",
        ),
        "uk",
      ),
  );

  return {
    items,
  };
}


function reportNumber(value) {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}


function reportRound(
  value,
  digits = 2,
) {
  const power =
    10 ** digits;

  return (
    Math.round(
      reportNumber(value) *
      power,
    ) / power
  );
}


function reportPercentDelta(
  previous,
  current,
) {
  const before =
    reportNumber(previous);

  const after =
    reportNumber(current);

  if (before === 0) {
    return null;
  }

  return reportRound(
    (
      (
        after -
        before
      ) /
      Math.abs(before)
    ) *
    100,
  );
}


function reportEvidence(
  ...groups
) {
  const result = [];
  const seen = new Set();

  for (
    const item of
    groups
      .flat(Infinity)
      .filter(Boolean)
  ) {
    const normalized = {
      source_document_id:
        item.source_document_id ??
        null,

      provider:
        item.provider ??
        null,

      url:
        item.url ??
        null,

      observed_at:
        item.observed_at ??
        null,

      statement_type:
        item.statement_type ??
        "source_fact",
    };

    const key =
      JSON.stringify(
        normalized,
      );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}


export function buildReportAnalyticsSection({
  availableYears = [],
  income = null,
  cashAssets = null,
  realEstate = null,
  vehicles = null,
  career = null,
  relations = null,
} = {}) {
  const years =
    normalizeYears(
      availableYears,
    ).sort(
      (a, b) =>
        a - b,
    );

  const byYear =
    (rows) =>
      new Map(
        (
          Array.isArray(rows)
            ? rows
            : []
        ).map(
          (row) => [
            Number(row.year),
            row,
          ],
        ),
      );

  const incomeByYear =
    byYear(
      income?.yearly,
    );

  const cashByYear =
    byYear(
      cashAssets?.yearly,
    );

  const realEstateByYear =
    byYear(
      realEstate?.yearly,
    );

  const vehicleByYear =
    byYear(
      vehicles?.yearly,
    );

  const careerByYear =
    byYear(
      career?.items,
    );

  const relationItems =
    Array.isArray(
      relations?.items,
    )
      ? relations.items
      : [];

  const careerTransitions =
    Array.isArray(
      career?.transitions,
    )
      ? career.transitions
      : [];

  const metrics =
    years.map(
      (year) => {
        const incomeRow =
          incomeByYear.get(year);

        const cashRow =
          cashByYear.get(year);

        const realEstateRow =
          realEstateByYear.get(year);

        const vehicleRow =
          vehicleByYear.get(year);

        const careerRow =
          careerByYear.get(year);

        const yearRelations =
          relationItems.filter(
            (item) =>
              Number(
                item.year,
              ) === year,
          );

        return {
          year,

          income_declarant_uah:
            reportNumber(
              incomeRow
                ?.declarant_uah,
            ),

          income_household_uah:
            reportNumber(
              incomeRow
                ?.household_uah,
            ),

          cash_declarant_by_currency: {
            ...(
              cashRow
                ?.declarant_by_currency ??
              {}
            ),
          },

          cash_household_by_currency: {
            ...(
              cashRow
                ?.household_by_currency ??
              {}
            ),
          },

          real_estate_items:
            realEstateRow
              ?.items
              ?.length ?? 0,

          vehicle_items:
            vehicleRow
              ?.items
              ?.length ?? 0,

          relation_count:
            yearRelations.length,

          career: {
            organization:
              careerRow
                ?.organization ??
              null,

            position:
              careerRow
                ?.position ??
              null,
          },

          statement_type:
            "calculation",

          evidence:
            reportEvidence(
              incomeRow?.evidence,
              cashRow?.evidence,

              (
                realEstateRow
                  ?.items ??
                []
              ).map(
                (item) =>
                  item.evidence,
              ),

              (
                vehicleRow
                  ?.items ??
                []
              ).map(
                (item) =>
                  item.evidence,
              ),

              careerRow?.evidence,

              yearRelations.map(
                (item) =>
                  item.evidence,
              ),
            ),
        };
      },
    );

  const transitions = [];
  const findings = [];

  for (
    let index = 1;
    index < metrics.length;
    index += 1
  ) {
    const previous =
      metrics[index - 1];

    const current =
      metrics[index];

    const yearGap =
      current.year -
      previous.year;

    if (yearGap !== 1) {
      continue;
    }

    const careerTransition =
      careerTransitions.find(
        (item) =>
          Number(
            item.from_year,
          ) ===
            previous.year &&
          Number(
            item.to_year,
          ) ===
            current.year,
      );

    const incomeDelta =
      reportRound(
        current
          .income_declarant_uah -
        previous
          .income_declarant_uah,
      );

    const incomeDeltaPercent =
      reportPercentDelta(
        previous
          .income_declarant_uah,

        current
          .income_declarant_uah,
      );

    const previousCashUah =
      reportNumber(
        previous
          .cash_declarant_by_currency
          ?.UAH,
      );

    const currentCashUah =
      reportNumber(
        current
          .cash_declarant_by_currency
          ?.UAH,
      );

    const cashUahDelta =
      reportRound(
        currentCashUah -
        previousCashUah,
      );

    const realEstateDelta =
      current
        .real_estate_items -
      previous
        .real_estate_items;

    const vehicleDelta =
      current
        .vehicle_items -
      previous
        .vehicle_items;

    const evidence =
      reportEvidence(
        previous.evidence,
        current.evidence,
      );

    const transition = {
      from_year:
        previous.year,

      to_year:
        current.year,

      year_gap:
        yearGap,

      income_delta_uah:
        incomeDelta,

      income_delta_percent:
        incomeDeltaPercent,

      cash_uah_delta:
        cashUahDelta,

      real_estate_count_delta:
        realEstateDelta,

      vehicle_count_delta:
        vehicleDelta,

      organization_changed:
        careerTransition
          ?.organization_changed ??
        null,

      position_changed:
        careerTransition
          ?.position_changed ??
        null,

      statement_type:
        "calculation",

      evidence,
    };

    transitions.push(
      transition,
    );

    if (
      cashUahDelta > 0 &&
      current
        .income_declarant_uah >
        0
    ) {
      const ratio =
        cashUahDelta /
        current
          .income_declarant_uah;

      if (ratio >= 0.75) {
        findings.push({
          rule_code:
            "PM_CASH_UAH_GROWTH_RATIO_V1",

          domain:
            "financial_dynamics",

          result:
            "review",

          severity:
            "review",

          score:
            Math.min(
              100,
              Math.round(
                50 +
                ratio * 25,
              ),
            ),

          message:
            "Приріст задекларованих грошових активів у UAH є значним порівняно із задекларованим доходом за цей рік.",

          details: {
            from_year:
              previous.year,

            to_year:
              current.year,

            cash_uah_delta:
              cashUahDelta,

            current_income_uah:
              current
                .income_declarant_uah,

            ratio:
              reportRound(
                ratio,
                4,
              ),
          },

          statement_type:
            "heuristic_signal",

          evidence,
        });
      }
    }

    if (
      incomeDeltaPercent !==
        null &&
      Math.abs(
        incomeDeltaPercent,
      ) >= 50
    ) {
      findings.push({
        rule_code:
          "PM_INCOME_CHANGE_50_V1",

        domain:
          "financial_dynamics",

        result:
          "change",

        severity:
          "info",

        score:
          Math.min(
            100,
            Math.round(
              50 +
              Math.abs(
                incomeDeltaPercent,
              ) / 2,
            ),
          ),

        message:
          "Задекларований дохід декларанта змінився на 50% або більше порівняно з попереднім роком.",

        details: {
          from_year:
            previous.year,

          to_year:
            current.year,

          income_delta_uah:
            incomeDelta,

          income_delta_percent:
            incomeDeltaPercent,
        },

        statement_type:
          "heuristic_signal",

        evidence,
      });
    }

    if (
      realEstateDelta !== 0
    ) {
      findings.push({
        rule_code:
          "PM_REAL_ESTATE_COUNT_CHANGE_V1",

        domain:
          "asset_dynamics",

        result:
          "change",

        severity:
          "info",

        score:
          Math.min(
            100,
            50 +
            Math.abs(
              realEstateDelta,
            ) * 10,
          ),

        message:
          "Змінилася кількість задекларованих записів нерухомості.",

        details: {
          from_year:
            previous.year,

          to_year:
            current.year,

          count_delta:
            realEstateDelta,

          previous_count:
            previous
              .real_estate_items,

          current_count:
            current
              .real_estate_items,
        },

        statement_type:
          "heuristic_signal",

        evidence,
      });
    }

    if (
      vehicleDelta !== 0
    ) {
      findings.push({
        rule_code:
          "PM_VEHICLE_COUNT_CHANGE_V1",

        domain:
          "asset_dynamics",

        result:
          "change",

        severity:
          "info",

        score:
          Math.min(
            100,
            50 +
            Math.abs(
              vehicleDelta,
            ) * 10,
          ),

        message:
          "Змінилася кількість задекларованих записів транспортних засобів.",

        details: {
          from_year:
            previous.year,

          to_year:
            current.year,

          count_delta:
            vehicleDelta,

          previous_count:
            previous
              .vehicle_items,

          current_count:
            current
              .vehicle_items,
        },

        statement_type:
          "heuristic_signal",

        evidence,
      });
    }

    if (
      careerTransition &&
      (
        careerTransition
          .organization_changed ===
          true ||
        careerTransition
          .position_changed ===
          true
      )
    ) {
      findings.push({
        rule_code:
          "PM_CAREER_CHANGE_V1",

        domain:
          "career_dynamics",

        result:
          "change",

        severity:
          "info",

        score:
          50,

        message:
          "Між сусідніми деклараційними роками зафіксовано зміну посади або місця роботи.",

        details: {
          from_year:
            previous.year,

          to_year:
            current.year,

          organization_changed:
            careerTransition
              .organization_changed,

          position_changed:
            careerTransition
              .position_changed,
        },

        statement_type:
          "heuristic_signal",

        evidence,
      });
    }
  }

  return {
    metrics,
    transitions,
    findings,
  };
}


export function buildMentionsSection({ rows = [] } = {}) {
  const items = (Array.isArray(rows) ? rows : []).map((row) => ({
    source_document_id: row.source_document_id ?? null,
    provider: row.provider ?? null,
    source: row.source ?? null,
    title: row.title ?? null,
    snippet: row.snippet ?? null,
    url: row.url ?? null,
    published_at: row.published_at ?? null,
    first_seen_at: row.first_seen_at ?? null,
    match_score: row.match_score == null ? null : Number(row.match_score),
    match_level: row.match_level ?? null,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
  }));

  return { total: items.length, items };
}

export function buildSourcesSection({ rows = [] } = {}) {
  const seen = new Set();
  const items = [];

  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = row?.id ?? null;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    items.push({
      source_document_id: id,
      source_type: row.source_type ?? null,
      provider: row.source_name ?? null,
      external_id: row.external_id ?? null,
      title: row.title ?? null,
      url: row.url ?? null,
      published_at: row.published_at ?? null,
      observed_at: row.fetched_at ?? null,
    });
  }

  return { items };
}

function safeExecutiveSummaryDetails(
  value,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const allowed = [
    "from_year",
    "to_year",
    "cash_uah_delta",
    "current_income_uah",
    "ratio",
    "income_delta_uah",
    "income_delta_percent",
    "count_delta",
    "previous_count",
    "current_count",
    "organization_changed",
    "position_changed",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) =>
          value[key] !== null &&
          value[key] !== undefined,
      )
      .map(
        (key) => [
          key,
          value[key],
        ],
      ),
  );
}


function resolveExecutiveSummaryEvidence(
  evidence,
  sources,
) {
  const normalizedEvidence =
    reportEvidence(
      evidence,
    );

  if (
    !sources ||
    typeof sources !== "object"
  ) {
    return normalizedEvidence;
  }

  const sourceItems =
    Array.isArray(
      sources?.items,
    )
      ? sources.items
      : [];

  const sourcesById =
    new Map(
      sourceItems
        .filter(
          (item) =>
            item
              ?.source_document_id,
        )
        .map(
          (item) => [
            item
              .source_document_id,
            item,
          ],
        ),
    );

  const seen =
    new Set();

  const resolved = [];

  for (
    const item
    of normalizedEvidence
  ) {
    const sourceId =
      item
        ?.source_document_id ??
      null;

    const source =
      sourceId
        ? sourcesById.get(
            sourceId,
          )
        : null;

    if (!source) {
      continue;
    }

    const statementType =
      item
        ?.statement_type ??
      "source_fact";

    const key =
      `${sourceId}::${statementType}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    resolved.push({
      source_document_id:
        sourceId,

      provider:
        source
          ?.provider ??
        null,

      url:
        source
          ?.url ??
        null,

      observed_at:
        source
          ?.observed_at ??
        null,

      statement_type:
        statementType,
    });
  }

  return resolved;
}


export function buildSubjectReportModelPayload({
  subject,
  generatedAt = new Date(),
  declarations = null,
  income = null,
  cashAssets = null,
  realEstate = null,
  vehicles = null,
  career = null,
  relatedPeople = null,
  relations = null,
  analytics = null,
  mentions = null,
  sources = null,
} = {}) {
  if (!subject) {
    return null;
  }

  const generated_at =
    isoTimestamp(generatedAt);

  const declarationSection = {
    available_years:
      normalizeYears(declarations?.available_years),
    items:
      Array.isArray(declarations?.items)
        ? declarations.items
        : [],
  };

  const availableYears =
    declarationSection.available_years;

  const incomeSection = {
    yearly:
      Array.isArray(income?.yearly)
        ? income.yearly
        : [],

    sources:
      Array.isArray(income?.sources)
        ? income.sources
        : [],
  };

  const cashAssetsSection = {
    yearly:
      Array.isArray(
        cashAssets?.yearly,
      )
        ? cashAssets.yearly
        : [],
  };

  const realEstateSection = {
    yearly:
      Array.isArray(
        realEstate?.yearly,
      )
        ? realEstate.yearly
        : [],
  };

  const vehicleSection = {
    yearly:
      Array.isArray(
        vehicles?.yearly,
      )
        ? vehicles.yearly
        : [],
  };

  const careerSection = {
    items:
      Array.isArray(
        career?.items,
      )
        ? career.items
        : [],

    transitions:
      Array.isArray(
        career?.transitions,
      )
        ? career.transitions
        : [],
  };

  const relatedPeopleSection = {
    items:
      Array.isArray(
        relatedPeople?.items,
      )
        ? relatedPeople.items
        : [],
  };

  const relationsSection = {
    items:
      Array.isArray(
        relations?.items,
      )
        ? relations.items
        : [],

    counts:
      relations?.counts &&
      typeof relations.counts ===
        "object"
        ? relations.counts
        : {},
  };

  const analyticsSection = {
    metrics:
      Array.isArray(
        analytics?.metrics,
      )
        ? analytics.metrics
        : [],

    transitions:
      Array.isArray(
        analytics?.transitions,
      )
        ? analytics.transitions
        : [],

    findings:
      Array.isArray(
        analytics?.findings,
      )
        ? analytics.findings
        : [],
  };

  const requireCanonicalSummaryEvidence =
  sources &&
  typeof sources ===
    "object";

  const executiveSummaryItems =
  analyticsSection
    .findings
    .map(
      (finding, index) => ({
        finding,
        index,

        evidence:
          resolveExecutiveSummaryEvidence(
            finding?.evidence,
            sources,
          ),
      }),
    )
    .filter(
      ({ evidence }) =>
        !requireCanonicalSummaryEvidence ||
        evidence.length > 0,
    )
    .sort(
      (left, right) => {
        const severityPriority = {
          review:
            2,

          info:
            1,
        };

        const leftSeverity =
          severityPriority[
            left
              .finding
              ?.severity
          ] ?? 0;

        const rightSeverity =
          severityPriority[
            right
              .finding
              ?.severity
          ] ?? 0;

        if (
          leftSeverity !==
          rightSeverity
        ) {
          return (
            rightSeverity -
            leftSeverity
          );
        }

        const leftScore =
          numericValue(
            left
              .finding
              ?.score,
          ) ?? -Infinity;

        const rightScore =
          numericValue(
            right
              .finding
              ?.score,
          ) ?? -Infinity;

        if (
          leftScore !==
          rightScore
        ) {
          return (
            rightScore -
            leftScore
          );
        }

        return (
          left.index -
          right.index
        );
      },
    )
    .slice(
      0,
      8,
    )
    .map(
      ({
        finding,
        evidence,
      }) => ({
        rule_code:
          cleanValue(
            finding?.rule_code,
          ),

        domain:
          cleanValue(
            finding?.domain,
          ),

        result:
          cleanValue(
            finding?.result,
          ),

        severity:
          cleanValue(
            finding?.severity,
          ),

        score:
          numericValue(
            finding?.score,
          ),

        message:
          cleanValue(
            finding?.message,
          ),

        details:
          safeExecutiveSummaryDetails(
            finding?.details,
          ),

        statement_type:
          cleanValue(
            finding?.statement_type,
          ),

        evidence,
      }),
    );

  const executiveSummarySection =
  executiveSummaryItems.length
    ? {
        status:
          "generated",

        items:
          executiveSummaryItems,
      }
    : {
        status:
          "not_generated",

        items: [],
      };

  return {
    schema_version:
      REPORT_MODEL_SCHEMA_VERSION,

    generated_at,

    meta: {
      report_id: null,

      schema_version:
        REPORT_MODEL_SCHEMA_VERSION,

      analytics_version:
        REPORT_ANALYTICS_VERSION,

      period: {
        from_year:
          availableYears.length
            ? Math.min(...availableYears)
            : null,
        to_year:
          availableYears.length
            ? Math.max(...availableYears)
            : null,
      },

      available_years:
        availableYears,
      freshness: [],
    },

    subject:
      subjectSection(subject),

    identity: {
      resolution_status: null,
      score: null,
      hard_match: null,
      review_required: null,
      identifiers: [],
      aliases: [],
      reasons: [],
    },

    executive_summary:
      executiveSummarySection,

    declarations:
      declarationSection,

    career:
      careerSection,

    related_people:
      relatedPeopleSection,

    income:
      incomeSection,

    cash_assets:
      cashAssetsSection,

    real_estate:
      realEstateSection,

    vehicles:
      vehicleSection,

    relations:
      relationsSection,

    analytics:
      analyticsSection,

    mentions: {
      total: mentions?.total ?? null,
      items: Array.isArray(mentions?.items) ? mentions.items : [],
    },

    sources: {
      items: Array.isArray(sources?.items) ? sources.items : [],
    },

    methodology: {
      report_model_version:
        REPORT_MODEL_SCHEMA_VERSION,

      analytics_version:
        REPORT_ANALYTICS_VERSION,

      rules_version:
        REPORT_RULES_VERSION,

      notes: [],

      limitations: [
        ...REPORT_MODEL_LIMITATIONS,
      ],
    },
  };
}

export async function buildSubjectReportModel(
  subjectId,
  options = {},
) {
  const subjectLoader =
    options.subjectLoader ??
    getSubject;

  const subject =
    await subjectLoader(
      subjectId,
    );

  if (!subject) {
    return null;
  }

  const yearsLoader =
    options.declarationYearsLoader ??
    loadDeclarationYears;

  const contextLoader =
    options.declarationContextLoader ??
    loadDeterministicDeclarationContext;

  const declarationOptions =
    options.declarationOptions ?? {};

  const availableYears =
    normalizeYears(
      await yearsLoader(
        subject.entity_id,
        declarationOptions,
      ),
    );

  const contexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          contextLoader(
            subject.entity_id,
            year,
            declarationOptions,
          ),
      ),
    );

  const declarations =
    buildDeclarationSection({
      availableYears,
      contexts,
    });

  const employmentContextLoader =
    options.employmentContextLoader ??
    loadDeterministicEmploymentContext;

  const employmentOptions =
    options.employmentOptions ?? {};

  const employmentContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          employmentContextLoader(
            subject.entity_id,
            year,
            employmentOptions,
          ),
      ),
    );

  const career =
    buildCareerSection({
      contexts:
        employmentContexts,
    });

  const familyContextLoader =
    options.familyContextLoader ??
    loadDeterministicFamilyContext;

  const familyOptions =
    options.familyOptions ?? {};

  const familyContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          familyContextLoader(
            subject.entity_id,
            year,
            familyOptions,
          ),
      ),
    );

  const relatedPeople =
    buildRelatedPeopleSection({
      familyContexts,
    });

  const singleYearIncomeLoader =
    options.incomeAnalyticsContextLoader ??
    loadDeterministicIncomeAnalyticsContext;

  const multiYearIncomeLoader =
    options.multiYearIncomeAnalyticsContextLoader ??
    loadDeterministicMultiYearIncomeAnalyticsContext;

  const incomeOptions =
    options.incomeOptions ?? {};

  const incomeDetailContextLoader =
    options.incomeDetailContextLoader ??
    loadDeterministicIncomeContext;

  let incomeContext = null;

  if (availableYears.length === 1) {
    incomeContext =
      await singleYearIncomeLoader(
        subject.entity_id,
        availableYears[0],
        incomeOptions,
      );
  } else if (availableYears.length >= 2) {
    incomeContext =
      await multiYearIncomeLoader(
        subject.entity_id,
        availableYears,
        incomeOptions,
      );
  }

  const incomeDetailContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          incomeDetailContextLoader(
            subject.entity_id,
            year,
            incomeOptions,
          ),
      ),
    );

  const income =
    buildIncomeSection({
      context:
        incomeContext,

      detailContexts:
        incomeDetailContexts,
    });

  const cashContextLoader =
    options.cashContextLoader ??
    loadDeterministicCashContext;

  const cashOptions =
    options.cashOptions ?? {};

  const cashContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          cashContextLoader(
            subject.entity_id,
            year,
            cashOptions,
          ),
      ),
    );

  const cashAssets =
    buildCashAssetsSection({
      contexts:
        cashContexts,
    });

  const realEstateContextLoader =
    options.realEstateContextLoader ??
    loadDeterministicRealEstateContext;

  const realEstateOptions =
    options.realEstateOptions ?? {};

  const realEstateContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          realEstateContextLoader(
            subject.entity_id,
            year,
            realEstateOptions,
          ),
      ),
    );

  const realEstate =
    buildRealEstateSection({
      contexts:
        realEstateContexts,
    });

  const vehicleContextLoader =
    options.vehicleContextLoader ??
    loadDeterministicVehicleContext;

  const vehicleOptions =
    options.vehicleOptions ?? {};

  const vehicleContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          vehicleContextLoader(
            subject.entity_id,
            year,
            vehicleOptions,
          ),
      ),
    );

  const vehicles =
    buildVehicleSection({
      contexts:
        vehicleContexts,
    });

  const relationsContextLoader =
    options.relationsContextLoader ??
    loadDeterministicRelationsContext;

  const relationsOptions =
    options.relationsOptions ?? {};

  const relationContexts =
    await Promise.all(
      availableYears.map(
        (year) =>
          relationsContextLoader(
            subject.entity_id,
            year,
            relationsOptions,
          ),
      ),
    );

  const relations =
    buildRelationsSection({
      contexts:
        relationContexts,
    });

  const thirdPartyPeople =
    buildThirdPartyPeopleSection({
      relations,
    });

  const relatedPeopleCombined = {
    items: [
      ...(
        relatedPeople?.items ??
        []
      ),

      ...(
        thirdPartyPeople?.items ??
        []
      ),
    ].sort(
      (a, b) =>
        Number(
          b.years?.[0] ?? 0,
        ) -
        Number(
          a.years?.[0] ?? 0,
        ) ||
        String(
          a.relation_type ?? "",
        ).localeCompare(
          String(
            b.relation_type ?? "",
          ),
        ) ||
        String(
          a.full_name ?? "",
        ).localeCompare(
          String(
            b.full_name ?? "",
          ),
          "uk",
        ),
    ),
  };

  const mentionsLoader =
    options.mentionsLoader ??
    listMentions;

  const sourceDocumentsLoader =
    options.sourceDocumentsLoader ??
    loadReportSourceDocuments;

  const mentionRows =
    await mentionsLoader(
      subject.id,
      options.mentionsLimit ?? 10000,
    );

  const sourceDocumentRows =
    await sourceDocumentsLoader(
      subject.id,
      subject.entity_id,
      options.sourceDocumentsOptions ?? {},
    );

  const mentions =
    buildMentionsSection({
      rows: mentionRows,
    });

  const sources =
    buildSourcesSection({
      rows: sourceDocumentRows,
    });

  const reportAnalytics =
    buildReportAnalyticsSection({
      availableYears,
      income,
      cashAssets,
      realEstate,
      vehicles,
      career,
      relations,
    });

  return buildSubjectReportModelPayload({
    subject,

    generatedAt:
      options.generatedAt ??
      new Date(),

    declarations,
    income,
    cashAssets,
    realEstate,
    vehicles,
    career,

    relatedPeople:
      relatedPeopleCombined,

    relations,

    analytics:
      reportAnalytics,

    mentions,
    sources,
  });
}
