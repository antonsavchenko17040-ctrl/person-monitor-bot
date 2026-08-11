import {
  buildSubjectSearchPlan,
} from "./subject-search-plan.js";

import {
  stableFingerprint,
} from "./utils.js";

export const SMART_GOOGLE_WEB_VERSION =
  "smart-google-web-v1";

function canonicalUrl(value) {
  const raw =
    String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  try {
    const url =
      new URL(raw);

    url.hash = "";

    for (
      const key
      of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
      ]
    ) {
      url.searchParams.delete(
        key,
      );
    }

    return url.toString();
  } catch {
    return raw.replace(
      /#.*$/,
      "",
    );
  }
}

export async function searchSmartGoogleWeb(
  subject,
  {
    searchQuery,
    maxQueries = 4,
    topics,
    planBuilder =
      buildSubjectSearchPlan,
  } = {},
) {
  if (
    typeof searchQuery !==
    "function"
  ) {
    throw new TypeError(
      "searchQuery must be a function",
    );
  }

  const plan =
    planBuilder(
      subject,
      {
        maxQueries,
        topics,
      },
    );

  const deduped =
    new Map();

  const errors = [];

  let requests = 0;
  let rawResults = 0;

  for (
    const planned
    of plan.queries
  ) {
    try {
      requests += 1;

      const results =
        await searchQuery(
          planned.query,
          {
            provider:
              "google-web",

            searchPlanItem:
              planned,
          },
        );

      for (
        const result
        of Array.isArray(results)
          ? results
          : []
      ) {
        rawResults += 1;

        const url =
          canonicalUrl(
            result?.url,
          );

        if (!url) {
          continue;
        }

        const key =
          stableFingerprint(
            url,
          );

        const enriched = {
          ...result,

          provider:
            "google-web",

          url,

          searchMetadata: {
            version:
              SMART_GOOGLE_WEB_VERSION,

            query_id:
              planned.id,

            query:
              planned.query,

            query_kind:
              planned.kind,

            query_priority:
              planned.priority,

            name_variant:
              planned.name_variant,

            context:
              planned.context,

            topic:
              planned.topic,
          },
        };

        if (
          !deduped.has(key)
        ) {
          deduped.set(
            key,
            enriched,
          );

          continue;
        }

        const existing =
          deduped.get(key);

        const queries =
          new Set([
            ...(
              existing
                ?.searchMetadata
                ?.matched_queries ??
              [
                existing
                  ?.searchMetadata
                  ?.query,
              ]
            ),

            planned.query,
          ]);

        existing.searchMetadata = {
          ...existing.searchMetadata,

          matched_queries:
            [...queries]
              .filter(Boolean),
        };
      }
    } catch (error) {
      errors.push({
        query_id:
          planned.id,

        query:
          planned.query,

        message:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  return {
    version:
      SMART_GOOGLE_WEB_VERSION,

    results:
      [...deduped.values()],

    errors,

    plan,

    stats: {
      planned_queries:
        plan.queries.length,

      requests,

      raw_results:
        rawResults,

      unique_results:
        deduped.size,

      failed_queries:
        errors.length,
    },
  };
}
