import { loadDeclarationYears, loadDeterministicDeclarationContext } from "./declaration-context.js";

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

export function buildSubjectReportModelPayload({
  subject,
  generatedAt = new Date(),
  declarations = null,
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

    income: {
      yearly: [],
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

  return buildSubjectReportModelPayload({
    subject,

    generatedAt:
      options.generatedAt ??
      new Date(),

    declarations,
  });
}
