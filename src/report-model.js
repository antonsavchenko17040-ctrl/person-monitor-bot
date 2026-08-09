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

export function buildSubjectReportModelPayload({
  subject,
  generatedAt = new Date(),
} = {}) {
  if (!subject) {
    return null;
  }

  const generated_at =
    isoTimestamp(generatedAt);

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
        from_year: null,
        to_year: null,
      },

      available_years: [],
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

    declarations: {
      available_years: [],
      items: [],
    },

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

  return buildSubjectReportModelPayload({
    subject,

    generatedAt:
      options.generatedAt ??
      new Date(),
  });
}
