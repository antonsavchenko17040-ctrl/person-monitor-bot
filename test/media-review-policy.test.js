import test from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_REVIEW_POLICY_VERSION,
  MEDIA_REVIEW_DECISIONS,
  decideMediaReview,
} from "../src/media-review-policy.js";

function corruption(
  relevant = true,
) {
  return {
    relevant,
    classification:
      relevant
        ? "direct"
        : "not_corruption",
  };
}

function identity(
  level,
  {
    hardConflict = false,
  } = {},
) {
  return {
    level,
    hard_conflict:
      hardConflict,
  };
}

test(
  "exports media review policy version",
  () => {
    assert.equal(
      MEDIA_REVIEW_POLICY_VERSION,
      "media-review-policy-v1",
    );
  },
);

test(
  "accepts confirmed identity in corruption material",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(true),

        mediaIdentity:
          identity(
            "confirmed",
          ),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.ACCEPT,
    );
  },
);

test(
  "sends probable identity to full text review",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(true),

        mediaIdentity:
          identity(
            "probable",
          ),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.FULL_TEXT_REVIEW,
    );
  },
);

test(
  "sends possible identity to full text review",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(true),

        mediaIdentity:
          identity(
            "possible",
          ),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.FULL_TEXT_REVIEW,
    );
  },
);

test(
  "rejects rejected identity",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(true),

        mediaIdentity:
          identity(
            "rejected",
          ),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.REJECT,
    );
  },
);

test(
  "rejects hard identity conflict without full text fetch",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(true),

        mediaIdentity:
          identity(
            "rejected",
            {
              hardConflict:
                true,
            },
          ),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.REJECT,
    );

    assert.match(
      output.reason,
      /жорсткий конфлікт/,
    );
  },
);

test(
  "rejects non corruption material even with confirmed identity",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(false),

        mediaIdentity:
          identity(
            "confirmed",
          ),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.REJECT,
    );
  },
);

test(
  "does not request full text when identity evidence is absent",
  () => {
    const output =
      decideMediaReview({
        corruptionRelevance:
          corruption(true),
      });

    assert.equal(
      output.decision,
      MEDIA_REVIEW_DECISIONS.REJECT,
    );
  },
);
