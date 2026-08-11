import {
  quoteQuery,
  subjectNames,
} from "./providers/query.js";

import {
  stableFingerprint,
} from "./utils.js";

export const CORRUPTION_SEARCH_PLAN_VERSION =
  "corruption-search-plan-v1";

export const CORRUPTION_QUERY_GROUPS =
  Object.freeze([
    {
      kind: "corruption_core",
      priority: 100,
      expression:
        "(корупція OR хабар OR \"неправомірна вигода\" OR підкуп)",
    },
    {
      kind: "corruption_assets",
      priority: 95,
      expression:
        "(\"незаконне збагачення\" OR \"необґрунтовані активи\" OR \"недостовірне декларування\" OR \"конфлікт інтересів\")",
    },
    {
      kind: "corruption_enforcement",
      priority: 90,
      expression:
        "(НАБУ OR САП OR ВАКС OR НАЗК) (підозра OR розслідування OR обвинувачення OR вирок)",
    },
    {
      kind: "corruption_office",
      priority: 85,
      expression:
        "(\"зловживання службовим становищем\" OR \"службове підроблення\" OR привласнення OR розтрата)",
    },
  ]);

function positiveInteger(
  value,
  fallback,
) {
  const number = Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  )
    ? number
    : fallback;
}

export function buildCorruptionSearchPlan(
  subject,
  {
    maxQueries = 4,
  } = {},
) {
  const names =
    subjectNames(
      subject ?? {},
    );

  if (!names.length) {
    return {
      version:
        CORRUPTION_SEARCH_PLAN_VERSION,

      queries: [],

      stats: {
        names: 0,
        queries: 0,
        corruption_groups: 0,
      },
    };
  }

  const limit =
    Math.min(
      CORRUPTION_QUERY_GROUPS.length,
      positiveInteger(
        maxQueries,
        4,
      ),
    );

  const primaryName =
    names[0];

  const queries =
    CORRUPTION_QUERY_GROUPS
      .slice(0, limit)
      .map(
        (group) => {
          const query =
            quoteQuery(
              primaryName,
            ) +
            " " +
            group.expression;

          return {
            id:
              stableFingerprint(
                CORRUPTION_SEARCH_PLAN_VERSION,
                group.kind,
                query,
              ),

            kind:
              group.kind,

            query,

            name_variant:
              primaryName,

            context:
              "corruption",

            topic:
              "corruption",

            priority:
              group.priority,
          };
        },
      );

  return {
    version:
      CORRUPTION_SEARCH_PLAN_VERSION,

    queries,

    stats: {
      names:
        names.length,

      queries:
        queries.length,

      corruption_groups:
        queries.length,
    },
  };
}
