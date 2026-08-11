import {
  MEDIA_FULL_TEXT_REVIEW_VERSION,
  reviewMediaResultFullText,
} from "./media-full-text-review.js";

export const MEDIA_PROVIDER_REVIEW_VERSION =
  "media-provider-review-v1";

function isReviewCandidate(
  mediaIdentity,
) {
  return (
    mediaIdentity?.level ===
      "probable" ||
    mediaIdentity?.level ===
      "possible"
  );
}

function isReviewFailure(
  review,
) {
  return [
    "fetch_failed",
    "extract_failed",
    "unavailable",
    "empty_text",
    "error",
  ].includes(
    review?.review_status,
  );
}

export function compactMediaFullTextReview(
  review,
) {
  const article =
    review?.full_text
      ?.article ??
    null;

  return {
    version:
      review?.version ??
      MEDIA_FULL_TEXT_REVIEW_VERSION,

    accepted:
      review?.accepted ===
      true,

    decision:
      review?.decision ??
      null,

    review_status:
      review?.review_status ??
      null,

    reason:
      review?.reason ??
      null,

    error:
      review?.error ??
      null,

    corruption_relevance:
      review?.full_text
        ?.corruption_relevance ??
      null,

    media_identity:
      review?.full_text
        ?.media_identity ??
      null,

    article:
      article
        ? {
            url:
              article.url ??
              null,

            fetch_metadata:
              article
                .fetch_metadata ??
              null,

            text_stats:
              article
                .text_stats ??
              null,
          }
        : null,
  };
}

function thrownReview(
  error,
) {
  return {
    version:
      MEDIA_FULL_TEXT_REVIEW_VERSION,

    accepted:
      false,

    decision:
      "reject",

    review_status:
      "error",

    reason:
      "помилка під час full-text verification",

    error: {
      name:
        error?.name ??
        "Error",

      message:
        error?.message ??
        String(error),
    },

    full_text:
      null,
  };
}

export async function verifyMediaResultForProvider(
  subject,
  item,
  {
    enabled = true,

    reviewFn =
      reviewMediaResultFullText,

    reviewOptions = {},
  } = {},
) {
  const corruptionRelevance =
    item?.corruptionRelevance ??
    null;

  const mediaIdentity =
    item?.mediaIdentity ??
    null;

  if (
    !corruptionRelevance
      ?.relevant
  ) {
    return {
      version:
        MEDIA_PROVIDER_REVIEW_VERSION,

      accepted:
        false,

      review_attempted:
        false,

      review_failed:
        false,

      item,
    };
  }

  if (
    mediaIdentity?.level ===
    "confirmed"
  ) {
    return {
      version:
        MEDIA_PROVIDER_REVIEW_VERSION,

      accepted:
        true,

      review_attempted:
        false,

      review_failed:
        false,

      item,
    };
  }

  if (
    !enabled ||
    !isReviewCandidate(
      mediaIdentity,
    )
  ) {
    return {
      version:
        MEDIA_PROVIDER_REVIEW_VERSION,

      accepted:
        false,

      review_attempted:
        false,

      review_failed:
        false,

      item,
    };
  }

  if (
    typeof reviewFn !==
    "function"
  ) {
    throw new TypeError(
      "reviewFn має бути функцією",
    );
  }

  let review;

  try {
    review =
      await reviewFn(
        subject,
        item,
        reviewOptions,
      );
  } catch (error) {
    review =
      thrownReview(
        error,
      );
  }

  const compactReview =
    compactMediaFullTextReview(
      review,
    );

  const finalCorruption =
    review?.full_text
      ?.corruption_relevance ??
    null;

  const finalIdentity =
    review?.full_text
      ?.media_identity ??
    null;

  const accepted =
    review?.accepted ===
      true &&
    finalCorruption
      ?.relevant ===
      true &&
    finalIdentity?.level ===
      "confirmed";

  if (accepted) {
    return {
      version:
        MEDIA_PROVIDER_REVIEW_VERSION,

      accepted:
        true,

      review_attempted:
        true,

      review_failed:
        false,

      item: {
        ...item,

        corruptionRelevance:
          finalCorruption,

        mediaIdentity:
          finalIdentity,

        fullTextReview:
          compactReview,
      },
    };
  }

  return {
    version:
      MEDIA_PROVIDER_REVIEW_VERSION,

    accepted:
      false,

    review_attempted:
      true,

    review_failed:
      isReviewFailure(
        review,
      ),

    item: {
      ...item,

      fullTextReview:
        compactReview,
    },
  };
}
