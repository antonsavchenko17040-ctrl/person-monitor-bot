import test from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_FULL_TEXT_REVIEW_VERSION,
  reviewMediaResultFullText,
} from "../src/media-full-text-review.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [],

    organization:
      "Національне агентство з питань запобігання корупції",

    position:
      "головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку",

    city:
      "Київ",
  };
}

function probableResult() {
  return {
    title:
      "Савченко Антон Віталійович",

    url:
      "https://example.com/case",

    snippet:
      "НАБУ розслідує хабар.",
  };
}

test(
  "exports full text review version",
  () => {
    assert.equal(
      MEDIA_FULL_TEXT_REVIEW_VERSION,
      "media-full-text-review-v1",
    );
  },
);

test(
  "does not fetch when snippet identity is already confirmed",
  async () => {
    let fetchCalls =
      0;

    const result =
      await reviewMediaResultFullText(
        subject(),
        {
          title:
            "Савченко Антон Віталійович",

          url:
            "https://example.com/confirmed",

          snippet:
            "Працівник Національного агентства з питань запобігання корупції. НАБУ розслідує хабар.",
        },
        {
          fetchArticleFn:
            async () => {
              fetchCalls += 1;

              throw new Error(
                "fetch не мав викликатися",
              );
            },
        },
      );

    assert.equal(
      result.accepted,
      true,
    );

    assert.equal(
      result.review_status,
      "not_required",
    );

    assert.equal(
      fetchCalls,
      0,
    );
  },
);

test(
  "does not fetch initially rejected material",
  async () => {
    let fetchCalls =
      0;

    const result =
      await reviewMediaResultFullText(
        subject(),
        {
          title:
            "Звичайна конференція",

          url:
            "https://example.com/ordinary",

          snippet:
            "Учасники обговорили цифрову трансформацію.",
        },
        {
          fetchArticleFn:
            async () => {
              fetchCalls += 1;

              throw new Error(
                "fetch не мав викликатися",
              );
            },
        },
      );

    assert.equal(
      result.accepted,
      false,
    );

    assert.equal(
      result.review_status,
      "not_required",
    );

    assert.equal(
      fetchCalls,
      0,
    );
  },
);

test(
  "upgrades probable identity to confirmed from full article",
  async () => {
    const result =
      await reviewMediaResultFullText(
        subject(),
        probableResult(),
        {
          fetchArticleFn:
            async () => ({
              url:
                "https://example.com/case",

              html:
                "<article><p>Савченко Антон Віталійович — працівник Національного агентства з питань запобігання корупції.</p><p>НАБУ розслідує хабар та неправомірну вигоду.</p></article>",

              metadata: {
                bytes:
                  250,
              },
            }),
        },
      );

    assert.equal(
      result.initial
        .mediaIdentity
        .level,
      "probable",
    );

    assert.equal(
      result.accepted,
      true,
    );

    assert.equal(
      result.review_status,
      "reviewed",
    );

    assert.equal(
      result.full_text
        .media_identity
        .level,
      "confirmed",
    );

    assert.equal(
      result.full_text
        .corruption_relevance
        .relevant,
      true,
    );
  },
);

test(
  "rejects after full text when identity remains probable",
  async () => {
    const result =
      await reviewMediaResultFullText(
        subject(),
        probableResult(),
        {
          fetchArticleFn:
            async () => ({
              url:
                "https://example.com/case",

              html:
                "<article><p>Савченко Антон Віталійович згадується у матеріалі.</p><p>НАБУ розслідує хабар.</p></article>",

              metadata: {},
            }),
        },
      );

    assert.equal(
      result.accepted,
      false,
    );

    assert.equal(
      result.decision,
      "reject",
    );

    assert.equal(
      result.review_status,
      "reviewed",
    );

    assert.equal(
      result.full_text
        .media_identity
        .level,
      "probable",
    );
  },
);

test(
  "rejects safely when article fetch fails",
  async () => {
    const result =
      await reviewMediaResultFullText(
        subject(),
        probableResult(),
        {
          fetchArticleFn:
            async () => {
              throw new Error(
                "network blocked",
              );
            },
        },
      );

    assert.equal(
      result.accepted,
      false,
    );

    assert.equal(
      result.review_status,
      "fetch_failed",
    );

    assert.equal(
      result.error.message,
      "network blocked",
    );
  },
);

test(
  "rejects safely when extracted article text is empty",
  async () => {
    const result =
      await reviewMediaResultFullText(
        subject(),
        probableResult(),
        {
          fetchArticleFn:
            async () => ({
              url:
                "https://example.com/case",

              html:
                "<html></html>",

              metadata: {},
            }),
        },
      );

    assert.equal(
      result.accepted,
      false,
    );

    assert.equal(
      result.review_status,
      "empty_text",
    );
  },
);
