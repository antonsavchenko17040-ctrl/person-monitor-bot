export const MEDIA_REVIEW_POLICY_VERSION =
  "media-review-policy-v1";

export const MEDIA_REVIEW_DECISIONS =
  Object.freeze({
    ACCEPT:
      "accept",

    FULL_TEXT_REVIEW:
      "full_text_review",

    REJECT:
      "reject",
  });

export function decideMediaReview({
  corruptionRelevance,
  mediaIdentity,
} = {}) {
  if (
    !corruptionRelevance?.relevant
  ) {
    return {
      version:
        MEDIA_REVIEW_POLICY_VERSION,

      decision:
        MEDIA_REVIEW_DECISIONS.REJECT,

      reason:
        "матеріал не має підтвердженого корупційного контексту",
    };
  }

  if (
    mediaIdentity?.hard_conflict
  ) {
    return {
      version:
        MEDIA_REVIEW_POLICY_VERSION,

      decision:
        MEDIA_REVIEW_DECISIONS.REJECT,

      reason:
        "виявлено жорсткий конфлікт ідентичності",
    };
  }

  if (
    mediaIdentity?.level ===
    "confirmed"
  ) {
    return {
      version:
        MEDIA_REVIEW_POLICY_VERSION,

      decision:
        MEDIA_REVIEW_DECISIONS.ACCEPT,

      reason:
        "корупційний контекст та особу підтверджено",
    };
  }

  if (
    mediaIdentity?.level ===
      "probable" ||
    mediaIdentity?.level ===
      "possible"
  ) {
    return {
      version:
        MEDIA_REVIEW_POLICY_VERSION,

      decision:
        MEDIA_REVIEW_DECISIONS.FULL_TEXT_REVIEW,

      reason:
        "для підтвердження особи потрібен повний текст матеріалу",
    };
  }

  return {
    version:
      MEDIA_REVIEW_POLICY_VERSION,

    decision:
      MEDIA_REVIEW_DECISIONS.REJECT,

    reason:
      "ідентичність суб’єкта не підтверджена",
  };
}
