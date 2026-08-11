import test from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_PROVIDER_REVIEW_VERSION,
  compactMediaFullTextReview,
  verifyMediaResultForProvider,
} from "../src/media-provider-review.js";

function baseItem(
  level,
) {
  return {
    title:
      "Савченко Антон Віталійович",

    url:
      "https://example.com/case",

    snippet:
      "НАБУ розслідує хабар.",

    corruptionRelevance: {
      relevant:
        true,

      classification:
        "direct",
    },

    mediaIdentity: {
      level,
      score:
        level ===
          "confirmed"
          ? 90
          : 70,
    },
  };
}

test(
  "exports provider review version",
  () => {
    assert.equal(
      MEDIA_PROVIDER_REVIEW_VERSION,
      "media-provider-review-v1",
    );
  },
);

test(
  "confirmed identity bypasses full text",
  async () => {
    let calls =
      0;

    const output =
      await verifyMediaResultForProvider(
        {},
        baseItem(
          "confirmed",
        ),
        {
          reviewFn:
            async () => {
              calls += 1;

              throw new Error(
                "не мав викликатися",
              );
            },
        },
      );

    assert.equal(
      output.accepted,
      true,
    );

    assert.equal(
      output.review_attempted,
      false,
    );

    assert.equal(
      calls,
      0,
    );
  },
);

test(
  "probable identity can be upgraded by full text",
  async () => {
    const output =
      await verifyMediaResultForProvider(
        {},
        baseItem(
          "probable",
        ),
        {
          reviewFn:
            async () => ({
              version:
                "media-full-text-review-v1",

              accepted:
                true,

              decision:
                "accept",

              review_status:
                "reviewed",

              reason:
                "confirmed",

              error:
                null,

              full_text: {
                corruption_relevance: {
                  relevant:
                    true,

                  classification:
                    "direct",
                },

                media_identity: {
                  level:
                    "confirmed",

                  score:
                    90,
                },

                corruption_role: {
                  version:
                    "media-corruption-role-v1",

                  role:
                    "adverse_context",

                  signals: [
                    "підозра",
                  ],

                  wrongdoing_inferred:
                    false,
                },

                article: {
                  url:
                    "https://example.com/case",

                  text:
                    "ЦЕЙ ТЕКСТ НЕ ПОВИНЕН ПОТРАПИТИ ДО PROVIDER RESULT",

                  fetch_metadata: {
                    bytes:
                      100,
                  },

                  text_stats: {
                    output_chars:
                      80,
                  },
                },
              },
            }),
        },
      );

    assert.equal(
      output.accepted,
      true,
    );

    assert.equal(
      output.review_attempted,
      true,
    );

    assert.equal(
      output.item
        .mediaIdentity
        .level,
      "confirmed",
    );

    assert.equal(
      output.item
        .corruptionRole
        .role,
      "adverse_context",
    );

    assert.equal(
      output.item
        .corruptionRole
        .wrongdoing_inferred,
      false,
    );

    assert.equal(
      output.item
        .fullTextReview
        .corruption_role
        .role,
      "adverse_context",
    );

    assert.equal(
      output.item
        .fullTextReview
        .corruption_role
        .wrongdoing_inferred,
      false,
    );

    assert.equal(
      output.item
        .fullTextReview
        .article
        .text,
      undefined,
    );

    assert.equal(
      JSON.stringify(
        output.item
          .fullTextReview,
      ).includes(
        "ЦЕЙ ТЕКСТ",
      ),
      false,
    );
  },
);

test(
  "probable identity remains rejected when full text is insufficient",
  async () => {
    const output =
      await verifyMediaResultForProvider(
        {},
        baseItem(
          "probable",
        ),
        {
          reviewFn:
            async () => ({
              version:
                "media-full-text-review-v1",

              accepted:
                false,

              decision:
                "reject",

              review_status:
                "reviewed",

              reason:
                "insufficient identity",

              error:
                null,

              full_text: {
                corruption_relevance: {
                  relevant:
                    true,
                },

                media_identity: {
                  level:
                    "probable",

                  score:
                    70,
                },

                article:
                  null,
              },
            }),
        },
      );

    assert.equal(
      output.accepted,
      false,
    );

    assert.equal(
      output.review_attempted,
      true,
    );

    assert.equal(
      output.review_failed,
      false,
    );
  },
);

test(
  "review exception becomes safe rejection",
  async () => {
    const output =
      await verifyMediaResultForProvider(
        {},
        baseItem(
          "probable",
        ),
        {
          reviewFn:
            async () => {
              throw new Error(
                "boom",
              );
            },
        },
      );

    assert.equal(
      output.accepted,
      false,
    );

    assert.equal(
      output.review_attempted,
      true,
    );

    assert.equal(
      output.review_failed,
      true,
    );

    assert.equal(
      output.item
        .fullTextReview
        .error
        .message,
      "boom",
    );
  },
);

test(
  "full text review can be explicitly disabled",
  async () => {
    let calls =
      0;

    const output =
      await verifyMediaResultForProvider(
        {},
        baseItem(
          "probable",
        ),
        {
          enabled:
            false,

          reviewFn:
            async () => {
              calls += 1;
            },
        },
      );

    assert.equal(
      output.accepted,
      false,
    );

    assert.equal(
      output.review_attempted,
      false,
    );

    assert.equal(
      calls,
      0,
    );
  },
);

test(
  "compact review never exposes article body",
  () => {
    const output =
      compactMediaFullTextReview({
        version:
          "media-full-text-review-v1",

        accepted:
          true,

        decision:
          "accept",

        review_status:
          "reviewed",

        full_text: {
          article: {
            url:
              "https://example.com/a",

            text:
              "SECRET",

            fetch_metadata: {},
            text_stats: {},
          },
        },
      });

    assert.equal(
      output.article.text,
      undefined,
    );

    assert.equal(
      JSON.stringify(
        output,
      ).includes(
        "SECRET",
      ),
      false,
    );
  },
);


test(
  "compact review preserves corruption role but strips identity context text",
  () => {
    const output =
      compactMediaFullTextReview({
        version:
          "media-full-text-review-v1",

        accepted:
          true,

        decision:
          "accept",

        review_status:
          "reviewed",

        full_text: {
          corruption_role: {
            version:
              "media-corruption-role-v1",

            role:
              "anti_corruption_activity",

            signals: [
              "співпраця",
            ],

            wrongdoing_inferred:
              false,
          },

          article: {
            url:
              "https://example.com/privacy",

            text:
              "ARTICLE SECRET",

            identity_context: {
              version:
                "media-identity-context-v1",

              text:
                "LOCAL IDENTITY SECRET",

              stats: {
                mention_windows:
                  1,

                context_chars:
                  120,

                truncated:
                  false,
              },
            },
          },
        },
      });

    assert.equal(
      output
        .corruption_role
        .role,
      "anti_corruption_activity",
    );

    assert.equal(
      output
        .corruption_role
        .wrongdoing_inferred,
      false,
    );

    assert.equal(
      output.article.text,
      undefined,
    );

    assert.equal(
      output.article
        .identity_context
        .text,
      undefined,
    );

    const serialized =
      JSON.stringify(
        output,
      );

    assert.equal(
      serialized.includes(
        "ARTICLE SECRET",
      ),
      false,
    );

    assert.equal(
      serialized.includes(
        "LOCAL IDENTITY SECRET",
      ),
      false,
    );
  },
);
