import { loadDeclarationYears, loadDeterministicDeclarationContext } from "./declaration-context.js";

import {
  loadDeterministicIncomeAnalyticsContext,
  loadDeterministicMultiYearIncomeAnalyticsContext,
  loadDeterministicIncomeContext,
} from "./income-context.js";

import {
  getSubject,
} from "./store.js";

export const REPORT_MODEL_SCHEMA_VERSION =
  "report-model-v1";

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

export function buildSubjectReportModelPayload({
  subject,
  generatedAt = new Date(),
  declarations = null,
  income = null,
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

  return {
    schema_version:
      REPORT_MODEL_SCHEMA_VERSION,

    generated_at,

    meta: {
      report_id: null,

      schema_version:
        REPORT_MODEL_SCHEMA_VERSION,

      analytics_version: null,

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

    executive_summary: {
      status: "not_generated",
      items: [],
    },

    declarations:
      declarationSection,

    career: {
      items: [],
      transitions: [],
    },

    related_people: {
      items: [],
    },

    income:
      incomeSection,

    cash_assets: {
      yearly: [],
    },

    real_estate: {
      yearly: [],
    },

    vehicles: {
      yearly: [],
    },

    relations: {
      items: [],
      counts: {},
    },

    analytics: {
      metrics: [],
      transitions: [],
      findings: [],
    },

    mentions: {
      total: null,
      items: [],
    },

    sources: {
      items: [],
    },

    methodology: {
      report_model_version:
        REPORT_MODEL_SCHEMA_VERSION,

      analytics_version: null,
      rules_version: null,

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

  return buildSubjectReportModelPayload({
    subject,

    generatedAt:
      options.generatedAt ??
      new Date(),

    declarations,
    income,
  });
}
