import { config } from "../config.js";
import { stableFingerprint } from "../utils.js";

import {
  buildCorruptionSearchPlan,
} from "../corruption-search-plan.js";

import {
  assessCorruptionRelevance,
} from "../corruption-relevance.js";

import {
  fetchText,
} from "./http.js";

export const CORRUPTION_GOOGLE_NEWS_VERSION =
  "corruption-google-news-v1";

function decodeXml(value = "") {
  return String(value)
    .replace(
      /<!\[CDATA\[([\s\S]*?)\]\]>/g,
      "$1",
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .trim();
}

function xmlTag(block, tag) {
  const pattern =
    new RegExp(
      "<" +
        tag +
        "(?:\\s[^>]*)?>" +
        "([\\s\\S]*?)" +
        "</" +
        tag +
        ">",
      "i",
    );

  const match =
    String(block ?? "")
      .match(pattern);

  return match
    ? decodeXml(match[1])
    : "";
}

function cleanHtml(value) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDate(value) {
  if (!value) {
    return undefined;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? undefined
    : date.toISOString();
}

function canonicalUrl(value) {
  const raw =
    String(value ?? "")
      .trim();

  if (!raw) {
    return "";
  }

  try {
    const url =
      new URL(raw);

    url.hash = "";

    return url.toString();
  } catch {
    return raw.replace(
      /#.*$/,
      "",
    );
  }
}

function parseRss(
  xml,
  planned,
  maxResults,
) {
  const blocks =
    [
      ...String(xml ?? "")
        .matchAll(
          /<item>([\s\S]*?)<\/item>/gi,
        ),
    ]
      .map(
        (match) =>
          match[1],
      )
      .slice(
        0,
        maxResults,
      );

  return blocks
    .map(
      (block) => ({
        provider:
          "google-news-rss",

        title:
          xmlTag(
            block,
            "title",
          ) ||
          "Без заголовка",

        url:
          canonicalUrl(
            xmlTag(
              block,
              "link",
            ),
          ),

        source:
          xmlTag(
            block,
            "source",
          ) ||
          undefined,

        snippet:
          cleanHtml(
            xmlTag(
              block,
              "description",
            ),
          ) ||
          undefined,

        publishedAt:
          safeDate(
            xmlTag(
              block,
              "pubDate",
            ),
          ),

        searchMetadata: {
          version:
            CORRUPTION_GOOGLE_NEWS_VERSION,

          query_id:
            planned.id,

          query:
            planned.query,

          query_kind:
            planned.kind,

          query_priority:
            planned.priority,

          context:
            "corruption",

          topic:
            "corruption",
        },
      }),
    )
    .filter(
      (item) =>
        /^https?:\/\//i
          .test(item.url),
    );
}

export async function searchGoogleNewsRssDetailed(
  subject,
  {
    fetchTextFn = fetchText,
    maxQueries = 4,
    maxResults,
  } = {},
) {
  const settings =
    config();

  const requestedLimit =
    Number(maxResults);

  const perQueryLimit =
    Number.isSafeInteger(
      requestedLimit,
    ) &&
    requestedLimit > 0
      ? requestedLimit
      : settings
          .maxResultsPerProvider;

  const plan =
    buildCorruptionSearchPlan(
      subject,
      {
        maxQueries,
      },
    );

  const deduped =
    new Map();

  const rejected = [];
  const errors = [];

  let requests = 0;
  let rawResults = 0;

  for (
    const planned
    of plan.queries
  ) {
    try {
      const endpoint =
        new URL(
          "https://news.google.com/rss/search",
        );

      endpoint.searchParams.set(
        "q",
        planned.query,
      );

      endpoint.searchParams.set(
        "hl",
        "uk",
      );

      endpoint.searchParams.set(
        "gl",
        "UA",
      );

      endpoint.searchParams.set(
        "ceid",
        "UA:uk",
      );

      requests += 1;

      const xml =
        await fetchTextFn(
          endpoint,
        );

      const items =
        parseRss(
          xml,
          planned,
          perQueryLimit,
        );

      rawResults +=
        items.length;

      for (
        const item
        of items
      ) {
        const corruptionRelevance =
          assessCorruptionRelevance(
            item,
          );

        if (
          !corruptionRelevance
            .relevant
        ) {
          rejected.push({
            title:
              item.title,

            url:
              item.url,

            corruptionRelevance,
          });

          continue;
        }

        const key =
          stableFingerprint(
            item.url,
          );

        if (
          !deduped.has(key)
        ) {
          deduped.set(
            key,
            {
              ...item,
              corruptionRelevance,
            },
          );

          continue;
        }

        const existing =
          deduped.get(key);

        const queries =
          new Set([
            ...(
              existing
                .searchMetadata
                ?.matched_queries ??
              [
                existing
                  .searchMetadata
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
      CORRUPTION_GOOGLE_NEWS_VERSION,

    results:
      [...deduped.values()],

    rejected_non_corruption:
      rejected,

    errors,
    plan,

    stats: {
      planned_queries:
        plan.queries.length,

      requests,

      raw_results:
        rawResults,

      corruption_relevant_results:
        deduped.size,

      filtered_non_corruption:
        rejected.length,

      unique_results:
        deduped.size,

      failed_queries:
        errors.length,
    },
  };
}

export async function searchGoogleNewsRss(
  subject,
  options = {},
) {
  const output =
    await searchGoogleNewsRssDetailed(
      subject,
      options,
    );

  if (
    output.errors.length
  ) {
    console.warn(
      "[google-news-rss] failed queries:",
      output.errors.length,
    );
  }

  return output.results;
}
