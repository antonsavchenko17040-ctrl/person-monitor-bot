import test from "node:test";
import assert from "node:assert/strict";

import {
  searchGoogleWeb,
  searchGoogleWebDetailed,
} from "../src/providers/google-web.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [
      "Антон Савченко",
    ],

    organization:
      "Національне агентство з питань запобігання корупції",

    position:
      "головний спеціаліст",

    city:
      "Київ",
  };
}

test(
  "google web detailed search executes smart plan",
  async () => {
    const calls = [];

    const output =
      await searchGoogleWebDetailed(
        subject(),
        {
          maxQueries: 3,

          searchQuery:
            async (
              query,
              options,
            ) => {
              calls.push({
                query,
                options,
              });

              return [
                {
                  title:
                    "Савченко Антон Віталійович — корупційний матеріал",

                  url:
                    "https://example.com/result",

                  snippet:
                    "Савченко Антон Віталійович, працівник Національного агентства з питань запобігання корупції. Повідомляється про хабар.",
                },
              ];
            },
        },
      );

    assert.equal(
      calls.length,
      3,
    );

    assert.equal(
      output.stats.requests,
      3,
    );

    assert.equal(
      output.results.length,
      1,
    );

    assert.ok(
      calls.every(
        (call) =>
          call.options.keepOperators ===
          true,
      ),
    );
  },
);

test(
  "google web keeps legacy provider array contract",
  async () => {
    const results =
      await searchGoogleWeb(
        subject(),
        {
          maxQueries: 2,

          searchQuery:
            async (
              query,
            ) => [
              {
                title:
                  "Result for " +
                  query,

                url:
                  "https://example.com/" +
                  encodeURIComponent(
                    query,
                  ),

                snippet:
                  "Савченко Антон Віталійович, працівник Національного агентства з питань запобігання корупції. Повідомляється про хабар.",
              },
            ],
        },
      );

    assert.ok(
      Array.isArray(results),
    );

    assert.equal(
      results.length,
      2,
    );

    assert.ok(
      results.every(
        (item) =>
          item.provider ===
          "google-web",
      ),
    );

    assert.ok(
      results.every(
        (item) =>
          item.searchMetadata
            ?.query,
      ),
    );
  },
);

test(
  "google web rejects result without corruption context",
  async () => {
    const output =
      await searchGoogleWebDetailed(
        subject(),
        {
          maxQueries: 1,

          searchQuery:
            async () => [
              {
                title:
                  "Звичайна біографія посадовця",

                url:
                  "https://example.com/profile",

                snippet:
                  "Інформація про освіту та професійну діяльність.",
              },
            ],
        },
      );

    assert.equal(
      output.results.length,
      0,
    );

    assert.equal(
      output.rejected_non_corruption.length,
      1,
    );

    assert.equal(
      output.stats.filtered_non_corruption,
      1,
    );
  },
);

test(
  "google web rejects corruption article about another person",
  async () => {
    const output =
      await searchGoogleWebDetailed(
        subject(),
        {
          maxQueries: 1,

          searchQuery:
            async () => [
              {
                title:
                  "Петренко Іван Іванович отримав підозру",

                url:
                  "https://example.com/other-person",

                snippet:
                  "НАБУ розслідує одержання неправомірної вигоди.",
              },
            ],
        },
      );

    assert.equal(
      output.results.length,
      0,
    );

    assert.equal(
      output.rejected_identity.length,
      1,
    );

    assert.equal(
      output.stats.filtered_identity_mismatch,
      1,
    );
  },
);

test(
  "google web accepts corruption article only with confirmed identity",
  async () => {
    const output =
      await searchGoogleWebDetailed(
        subject(),
        {
          maxQueries: 1,

          searchQuery:
            async () => [
              {
                title:
                  "Савченко Антон Віталійович",

                url:
                  "https://example.com/confirmed-person",

                snippet:
                  "Працівник Національного агентства з питань запобігання корупції фігурує у матеріалі про хабар.",
              },
            ],
        },
      );

    assert.equal(
      output.results.length,
      1,
    );

    assert.equal(
      output.results[0]
        .mediaIdentity
        .level,
      "confirmed",
    );
  },
);
