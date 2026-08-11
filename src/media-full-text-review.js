import {
  fetchArticleHtml,
} from "./article-fetch.js";

import {
  extractArticleText,
} from "./article-text.js";

import {
  assessCorruptionRelevance,
} from "./corruption-relevance.js";

import {
  assessMediaIdentity,
} from "./media-identity.js";

import {
  MEDIA_REVIEW_DECISIONS,
  decideMediaReview,
} from "./media-review-policy.js";

export const MEDIA_FULL_TEXT_REVIEW_VERSION =
  "media-full-text-review-v1";

function initialAssessments(
  subject,
  result,
) {
  const corruptionRelevance =
    result?.corruptionRelevance ??
    assessCorruptionRelevance(
      result,
    );

  const mediaIdentity =
    result?.mediaIdentity ??
    assessMediaIdentity(
      subject,
      result,
    );

  const policy =
    decideMediaReview({
      corruptionRelevance,
      mediaIdentity,
    });

  return {
    corruptionRelevance,
    mediaIdentity,
    policy,
  };
}

function rejectedResult({
  initial,
  reviewStatus,
  reason,
  error = null,
  article = null,
  fullTextCorruption = null,
  fullTextIdentity = null,
}) {
  return {
    version:
      MEDIA_FULL_TEXT_REVIEW_VERSION,

    accepted:
      false,

    decision:
      MEDIA_REVIEW_DECISIONS.REJECT,

    review_status:
      reviewStatus,

    reason,

    initial,

    full_text: {
      corruption_relevance:
        fullTextCorruption,

      media_identity:
        fullTextIdentity,

      article,
    },

    error:
      error
        ? {
            name:
              error?.name ??
              "Error",

            message:
              error?.message ??
              String(error),
          }
        : null,
  };
}

export async function reviewMediaResultFullText(
  subject,
  result,
  {
    fetchArticleFn =
      fetchArticleHtml,

    extractTextFn =
      extractArticleText,
  } = {},
) {
  if (
    typeof fetchArticleFn !==
    "function"
  ) {
    throw new TypeError(
      "fetchArticleFn має бути функцією",
    );
  }

  if (
    typeof extractTextFn !==
    "function"
  ) {
    throw new TypeError(
      "extractTextFn має бути функцією",
    );
  }

  const initial =
    initialAssessments(
      subject,
      result,
    );

  if (
    initial.policy.decision ===
    MEDIA_REVIEW_DECISIONS.ACCEPT
  ) {
    return {
      version:
        MEDIA_FULL_TEXT_REVIEW_VERSION,

      accepted:
        true,

      decision:
        MEDIA_REVIEW_DECISIONS.ACCEPT,

      review_status:
        "not_required",

      reason:
        "матеріал підтверджено без завантаження повного тексту",

      initial,

      full_text:
        null,

      error:
        null,
    };
  }

  if (
    initial.policy.decision ===
    MEDIA_REVIEW_DECISIONS.REJECT
  ) {
    return rejectedResult({
      initial,

      reviewStatus:
        "not_required",

      reason:
        initial.policy.reason,
    });
  }

  const url =
    String(
      result?.url ?? "",
    )
      .trim();

  if (!url) {
    return rejectedResult({
      initial,

      reviewStatus:
        "unavailable",

      reason:
        "немає URL для перевірки повного тексту",
    });
  }

  let fetched;

  try {
    fetched =
      await fetchArticleFn(
        url,
      );
  } catch (error) {
    return rejectedResult({
      initial,

      reviewStatus:
        "fetch_failed",

      reason:
        "не вдалося безпечно отримати повний текст матеріалу",

      error,
    });
  }

  let extracted;

  try {
    extracted =
      await extractTextFn(
        fetched?.html ?? "",
      );
  } catch (error) {
    return rejectedResult({
      initial,

      reviewStatus:
        "extract_failed",

      reason:
        "не вдалося витягнути текст матеріалу",

      error,
    });
  }

  const articleText =
    String(
      extracted?.text ?? "",
    )
      .trim();

  const article = {
    url:
      fetched?.url ??
      url,

    text:
      articleText,

    fetch_metadata:
      fetched?.metadata ??
      null,

    text_stats:
      extracted?.stats ??
      null,
  };

  if (!articleText) {
    return rejectedResult({
      initial,

      reviewStatus:
        "empty_text",

      reason:
        "повний текст матеріалу порожній",

      article,
    });
  }

  const fullTextResult = {
    ...result,

    url:
      article.url,

    snippet:
      articleText,
  };

  delete fullTextResult
    .corruptionRelevance;

  delete fullTextResult
    .mediaIdentity;

  const fullTextCorruption =
    assessCorruptionRelevance(
      fullTextResult,
    );

  const fullTextIdentity =
    assessMediaIdentity(
      subject,
      fullTextResult,
    );

  const finalPolicy =
    decideMediaReview({
      corruptionRelevance:
        fullTextCorruption,

      mediaIdentity:
        fullTextIdentity,
    });

  if (
    finalPolicy.decision ===
    MEDIA_REVIEW_DECISIONS.ACCEPT
  ) {
    return {
      version:
        MEDIA_FULL_TEXT_REVIEW_VERSION,

      accepted:
        true,

      decision:
        MEDIA_REVIEW_DECISIONS.ACCEPT,

      review_status:
        "reviewed",

      reason:
        "особу та корупційний контекст підтверджено за повним текстом",

      initial,

      full_text: {
        corruption_relevance:
          fullTextCorruption,

        media_identity:
          fullTextIdentity,

        article,
      },

      error:
        null,
    };
  }

  return rejectedResult({
    initial,

    reviewStatus:
      "reviewed",

    reason:
      finalPolicy.decision ===
      MEDIA_REVIEW_DECISIONS
        .FULL_TEXT_REVIEW
        ? "повний текст не дав достатніх доказів для confirmed identity"
        : finalPolicy.reason,

    article,

    fullTextCorruption,
    fullTextIdentity,
  });
}
