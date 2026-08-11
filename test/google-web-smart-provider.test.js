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
                    "Synthetic result",

                  url:
                    "https://example.com/result",

                  snippet:
                    query,
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
                  query,
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
