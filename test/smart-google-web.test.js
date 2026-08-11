import test from "node:test";
import assert from "node:assert/strict";

import {
  SMART_GOOGLE_WEB_VERSION,
  searchSmartGoogleWeb,
} from "../src/smart-google-web.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [
      "Антон Савченко",
      "Anton Savchenko",
    ],

    organization:
      "Національне агентство з питань запобігання корупції",

    position:
      "головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку",

    city:
      "Київ",
  };
}

test(
  "executes only the configured highest-priority queries",
  async () => {
    const calls = [];

    const output =
      await searchSmartGoogleWeb(
        subject(),
        {
          maxQueries: 4,

          searchQuery:
            async (
              query,
              options,
            ) => {
              calls.push({
                query,
                options,
              });

              return [];
            },
        },
      );

    assert.equal(
      output.version,
      SMART_GOOGLE_WEB_VERSION,
    );

    assert.equal(
      calls.length,
      4,
    );

    assert.deepEqual(
      calls.map(
        (call) =>
          call.query,
      ),
      [
        "\"Савченко Антон Віталійович\"",
        "\"Савченко Антон Віталійович\" \"Національне агентство з питань запобігання корупції\"",
        "\"Савченко Антон Віталійович\" \"головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку\"",
        "\"Антон Савченко\"",
      ],
    );

    assert.equal(
      output.stats.requests,
      4,
    );

    assert.equal(
      output.stats.failed_queries,
      0,
    );
  },
);

test(
  "deduplicates the same URL across different search queries",
  async () => {
    let callNumber = 0;

    const output =
      await searchSmartGoogleWeb(
        subject(),
        {
          maxQueries: 2,

          searchQuery:
            async () => {
              callNumber += 1;

              if (
                callNumber === 1
              ) {
                return [
                  {
                    provider:
                      "google-serper",

                    title:
                      "Перший результат",

                    url:
                      "https://example.com/article?utm_source=google#part",

                    snippet:
                      "Савченко Антон Віталійович НАЗК",
                  },
                ];
              }

              return [
                {
                  provider:
                    "google-serpapi",

                  title:
                    "Той самий результат",

                  url:
                    "https://example.com/article",

                  snippet:
                    "Повторний результат",
                },
              ];
            },
        },
      );

    assert.equal(
      output.stats.raw_results,
      2,
    );

    assert.equal(
      output.stats.unique_results,
      1,
    );

    assert.equal(
      output.results.length,
      1,
    );

    assert.equal(
      output.results[0].provider,
      "google-web",
    );

    assert.equal(
      output.results[0].url,
      "https://example.com/article",
    );

    assert.equal(
      output.results[0]
        .searchMetadata
        .matched_queries
        .length,
      2,
    );
  },
);

test(
  "preserves search provenance on every unique result",
  async () => {
    const output =
      await searchSmartGoogleWeb(
        subject(),
        {
          maxQueries: 1,

          searchQuery:
            async () => [
              {
                title:
                  "НАЗК — результат",

                url:
                  "https://example.com/nazk",

                source:
                  "example.com",

                snippet:
                  "Савченко Антон Віталійович",
              },
            ],
        },
      );

    const result =
      output.results[0];

    assert.equal(
      result.searchMetadata.version,
      SMART_GOOGLE_WEB_VERSION,
    );

    assert.equal(
      result.searchMetadata.query_kind,
      "exact_name",
    );

    assert.equal(
      result.searchMetadata.query_priority,
      100,
    );

    assert.equal(
      result.searchMetadata.name_variant,
      "Савченко Антон Віталійович",
    );

    assert.equal(
      typeof result.searchMetadata.query_id,
      "string",
    );

    assert.ok(
      result.searchMetadata.query_id.length > 0,
    );
  },
);

test(
  "isolates a failed query and continues remaining searches",
  async () => {
    let calls = 0;

    const output =
      await searchSmartGoogleWeb(
        subject(),
        {
          maxQueries: 4,

          searchQuery:
            async (
              query,
              options,
            ) => {
              calls += 1;

              if (
                options
                  .searchPlanItem
                  .kind ===
                "name_position"
              ) {
                throw new Error(
                  "synthetic provider failure",
                );
              }

              return [
                {
                  title:
                    "Результат " +
                    calls,

                  url:
                    "https://example.com/" +
                    calls,

                  snippet:
                    query,
                },
              ];
            },
        },
      );

    assert.equal(
      calls,
      4,
    );

    assert.equal(
      output.stats.requests,
      4,
    );

    assert.equal(
      output.stats.failed_queries,
      1,
    );

    assert.equal(
      output.errors.length,
      1,
    );

    assert.match(
      output.errors[0].message,
      /synthetic provider failure/,
    );

    assert.equal(
      output.results.length,
      3,
    );
  },
);

test(
  "requires explicit search function",
  async () => {
    await assert.rejects(
      () =>
        searchSmartGoogleWeb(
          subject(),
        ),

      /searchQuery must be a function/,
    );
  },
);
