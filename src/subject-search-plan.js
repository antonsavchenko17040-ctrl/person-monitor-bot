import {
  quoteQuery,
  subjectNames,
} from "./providers/query.js";

import {
  stableFingerprint,
} from "./utils.js";

export const SUBJECT_SEARCH_PLAN_VERSION =
  "subject-search-plan-v1";

export const DEFAULT_SEARCH_TOPICS =
  Object.freeze([
    "суд",
    "розслідування",
    "компанія",
    "закупівлі",
    "нерухомість",
    "автомобіль",
  ]);

function cleanText(value) {
  return String(value ?? "")
    .replace(/\\s+/g, " ")
    .trim();
}

function positiveInteger(
  value,
  fallback,
) {
  const number =
    Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  )
    ? number
    : fallback;
}

function addQuery(
  list,
  seen,
  {
    kind,
    query,
    nameVariant,
    context = null,
    topic = null,
    priority,
  },
) {
  const normalizedQuery =
    cleanText(query);

  if (
    !normalizedQuery ||
    seen.has(normalizedQuery)
  ) {
    return;
  }

  seen.add(normalizedQuery);

  list.push({
    id:
      stableFingerprint(
        SUBJECT_SEARCH_PLAN_VERSION,
        kind,
        normalizedQuery,
      ),

    kind,
    query:
      normalizedQuery,

    name_variant:
      nameVariant,

    context,
    topic,
    priority,
  });
}

export function buildSubjectSearchPlan(
  subject,
  {
    maxQueries = 16,
    topics =
      DEFAULT_SEARCH_TOPICS,
  } = {},
) {
  const limit =
    Math.min(
      50,
      positiveInteger(
        maxQueries,
        16,
      ),
    );

  const names =
    subjectNames(
      subject ?? {},
    );

  if (!names.length) {
    return {
      version:
        SUBJECT_SEARCH_PLAN_VERSION,

      queries: [],

      stats: {
        names: 0,
        queries: 0,
      },
    };
  }

  const primaryName =
    names[0];

  const organization =
    cleanText(
      subject?.organization,
    );

  const position =
    cleanText(
      subject?.position,
    );

  const city =
    cleanText(
      subject?.city,
    );

  const plan = [];
  const seen =
    new Set();

  for (
    const [
      nameIndex,
      name,
    ]
    of names.entries()
  ) {
    addQuery(
      plan,
      seen,
      {
        kind:
          "exact_name",

        query:
          quoteQuery(name),

        nameVariant:
          name,

        priority:
          nameIndex === 0
            ? 100
            : (
                name
                  .split(/\\s+/)
                  .filter(Boolean)
                  .length >= 3
                  ? 85
                  : 60
              ),
      },
    );
  }

  if (organization) {
    addQuery(
      plan,
      seen,
      {
        kind:
          "name_organization",

        query:
          quoteQuery(
            primaryName,
          ) +
          " " +
          quoteQuery(
            organization,
          ),

        nameVariant:
          primaryName,

        context:
          organization,

        priority:
          95,
      },
    );
  }

  if (position) {
    addQuery(
      plan,
      seen,
      {
        kind:
          "name_position",

        query:
          quoteQuery(
            primaryName,
          ) +
          " " +
          quoteQuery(
            position,
          ),

        nameVariant:
          primaryName,

        context:
          position,

        priority:
          90,
      },
    );
  }

  if (city) {
    addQuery(
      plan,
      seen,
      {
        kind:
          "name_city",

        query:
          quoteQuery(
            primaryName,
          ) +
          " " +
          quoteQuery(
            city,
          ),

        nameVariant:
          primaryName,

        context:
          city,

        priority:
          80,
      },
    );
  }

  for (
    const rawTopic
    of topics ?? []
  ) {
    const topic =
      cleanText(
        rawTopic,
      );

    if (!topic) {
      continue;
    }

    addQuery(
      plan,
      seen,
      {
        kind:
          "name_topic",

        query:
          quoteQuery(
            primaryName,
          ) +
          " " +
          topic,

        nameVariant:
          primaryName,

        topic,

        priority:
          70,
      },
    );
  }

  const queries =
    plan
      .sort(
        (a, b) =>
          b.priority -
          a.priority,
      )
      .slice(
        0,
        limit,
      );

  return {
    version:
      SUBJECT_SEARCH_PLAN_VERSION,

    queries,

    stats: {
      names:
        names.length,

      queries:
        queries.length,

      exact_name:
        queries.filter(
          (item) =>
            item.kind ===
            "exact_name",
        ).length,

      contextual:
        queries.filter(
          (item) =>
            item.kind ===
              "name_organization" ||
            item.kind ===
              "name_position" ||
            item.kind ===
              "name_city",
        ).length,

      topical:
        queries.filter(
          (item) =>
            item.kind ===
            "name_topic",
        ).length,
    },
  };
}
