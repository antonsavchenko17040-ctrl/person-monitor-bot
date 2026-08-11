import { config } from "../config.js";
import { fetchJson } from "./http.js";
import { buildNameQuery } from "./query.js";
import { searchSmartGoogleWeb } from "../smart-google-web.js";
import { buildCorruptionSearchPlan } from "../corruption-search-plan.js";
import { assessCorruptionRelevance } from "../corruption-relevance.js";
import { assessMediaIdentity } from "../media-identity.js";
import { verifyMediaResultForProvider } from "../media-provider-review.js";

function safeDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function simpleSerperQuery(query) {
  return String(query ?? "")
    .replaceAll('"', "")
    .replace(/[()]/g, " ")
    .replace(/\s+OR\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchSerpApiQuery(query, options = {}) {
  const settings = config();
  if (!settings.serpApiKey) return [];

  const endpoint = new URL("https://serpapi.com/search.json");
  endpoint.searchParams.set("engine", "google");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("gl", "ua");
  endpoint.searchParams.set("hl", "uk");
  endpoint.searchParams.set("num", String(settings.maxResultsPerProvider));
  endpoint.searchParams.set("api_key", settings.serpApiKey);

  const parsed = await fetchJson(endpoint);
  if (parsed.error) throw new Error(String(parsed.error));
  const organic = Array.isArray(parsed.organic_results) ? parsed.organic_results : [];

  return organic.slice(0, settings.maxResultsPerProvider).map((item) => ({
    provider: options.provider ?? "google-serpapi",
    title: String(item.title ?? "Без заголовка"),
    url: String(item.link ?? ""),
    source: options.source ?? (item.source?.name ? String(item.source.name) : undefined),
    snippet: item.snippet ? String(item.snippet) : undefined,
    publishedAt: safeDate(item.date),
  })).filter((item) => /^https?:\/\//i.test(item.url));
}

export async function searchSerperQuery(query, options = {}) {
  const settings = config();
  if (!settings.serperApiKey) return [];

  const parsed = await fetchJson("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": settings.serperApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: options.keepOperators ? query : simpleSerperQuery(query),
      gl: "ua",
      hl: "uk",
      num: settings.maxResultsPerProvider,
    }),
  });

  if (parsed.error || parsed.message) {
    throw new Error(String(parsed.error ?? parsed.message));
  }

  const organic = Array.isArray(parsed.organic) ? parsed.organic : [];
  return organic.slice(0, settings.maxResultsPerProvider).map((item) => ({
    provider: options.provider ?? "google-serper",
    title: String(item.title ?? "Без заголовка"),
    url: String(item.link ?? ""),
    source: options.source ?? (item.source ? String(item.source) : undefined),
    snippet: item.snippet ? String(item.snippet) : undefined,
    publishedAt: safeDate(item.date),
  })).filter((item) => /^https?:\/\//i.test(item.url));
}

export async function searchGoogleQuery(query, options = {}) {
  const settings = config();

  if (
    !settings.serperApiKey &&
    !settings.serpApiKey
  ) {
    return [];
  }

  if (settings.serperApiKey) {
    try {
      return await searchSerperQuery(
        query,
        options,
      );
    } catch (serperError) {
      if (!settings.serpApiKey) {
        throw serperError;
      }

      try {
        return await searchSerpApiQuery(
          query,
          options,
        );
      } catch (serpApiError) {
        throw new Error(
          "Serper.dev: " +
          (
            serperError instanceof Error
              ? serperError.message
              : String(serperError)
          ) +
          "; SerpApi: " +
          (
            serpApiError instanceof Error
              ? serpApiError.message
              : String(serpApiError)
          ),
        );
      }
    }
  }

  return searchSerpApiQuery(
    query,
    options,
  );
}

async function searchGoogleWebDetailedRaw(
  subject,
  {
    searchQuery = searchGoogleQuery,
    maxQueries,
  } = {},
) {
  const settings = config();

  return searchSmartGoogleWeb(
    subject,
    {
      maxQueries:
        maxQueries ??
        settings.maxGoogleWebQueries,

      planBuilder:
        buildCorruptionSearchPlan,

      searchQuery:
        (query, options) =>
          searchQuery(
            query,
            {
              ...options,
              keepOperators: true,
            },
          ),
    },
  );
}

export async function searchGoogleWebDetailed(
  subject,
  options = {},
) {
  const output =
    await searchGoogleWebDetailedRaw(
      subject,
      options,
    );

  const corruptionAccepted = [];
  const rejectedCorruption = [];

  for (const item of output.results) {
    const corruptionRelevance =
      assessCorruptionRelevance(
        item,
      );

    if (
      corruptionRelevance.relevant
    ) {
      corruptionAccepted.push({
        ...item,
        corruptionRelevance,
      });
    } else {
      rejectedCorruption.push({
        title:
          item.title,
        url:
          item.url,
        corruptionRelevance,
      });
    }
  }

  const accepted = [];
  const rejectedIdentity = [];

  let fullTextReviewRequests = 0;
  let fullTextReviewAccepted = 0;
  let fullTextReviewRejected = 0;
  let fullTextReviewFailures = 0;

  for (
    const item
    of corruptionAccepted
  ) {
    const mediaIdentity =
      assessMediaIdentity(
        subject,
        item,
      );

    const verification =
      await verifyMediaResultForProvider(
        subject,
        {
          ...item,
          mediaIdentity,
        },
        {
          enabled:
            options.fullTextReview !==
            false,

          reviewFn:
            options.fullTextReviewFn,

          reviewOptions:
            options.fullTextReviewOptions ??
            {},
        },
      );

    if (
      verification.review_attempted
    ) {
      fullTextReviewRequests +=
        1;

      if (
        verification.accepted
      ) {
        fullTextReviewAccepted +=
          1;
      } else {
        fullTextReviewRejected +=
          1;
      }

      if (
        verification.review_failed
      ) {
        fullTextReviewFailures +=
          1;
      }
    }

    if (
      verification.accepted
    ) {
      accepted.push(
        verification.item,
      );

      continue;
    }

    rejectedIdentity.push({
      title:
        item.title,

      url:
        item.url,

      corruptionRelevance:
        item.corruptionRelevance,

      mediaIdentity,

      fullTextReview:
        verification.item
          ?.fullTextReview ??
        null,
    });
  }

  return {
    ...output,

    results:
      accepted,

    rejected_non_corruption:
      rejectedCorruption,

    rejected_identity:
      rejectedIdentity,

    stats: {
      ...output.stats,

      unique_results_before_corruption_filter:
        output.stats.unique_results,

      corruption_relevant_results:
        corruptionAccepted.length,

      filtered_non_corruption:
        rejectedCorruption.length,

      unique_results_before_identity_filter:
        corruptionAccepted.length,

      confirmed_identity_results:
        accepted.length,

      filtered_identity_mismatch:
        rejectedIdentity.length,

      full_text_review_requests:
        fullTextReviewRequests,

      full_text_review_accepted:
        fullTextReviewAccepted,

      full_text_review_rejected:
        fullTextReviewRejected,

      full_text_review_failures:
        fullTextReviewFailures,

      unique_results:
        accepted.length,
    },
  };
}

export async function searchGoogleWeb(
  subject,
  options = {},
) {
  const output =
    await searchGoogleWebDetailed(
      subject,
      options,
    );

  if (output.errors.length) {
    console.warn(
      "[google-web] failed queries:",
      output.errors.length,
    );
  }

  return output.results;
}
