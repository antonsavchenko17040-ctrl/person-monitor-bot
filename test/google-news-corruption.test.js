import test from "node:test";
import assert from "node:assert/strict";

import {
  searchGoogleNewsRssDetailed,
} from "../src/providers/google-news.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [],

    organization:
      "Національне агентство з питань запобігання корупції",
  };
}

function rss(items) {
  return (
    "<?xml version=\"1.0\"?>" +
    "<rss><channel>" +
    items.join("") +
    "</channel></rss>"
  );
}

function item(
  title,
  link,
  description,
) {
  return (
    "<item>" +
    "<title><![CDATA[" +
    title +
    "]]></title>" +
    "<link>" +
    link +
    "</link>" +
    "<source>Example News</source>" +
    "<description><![CDATA[" +
    description +
    "]]></description>" +
    "<pubDate>Tue, 11 Aug 2026 10:00:00 GMT</pubDate>" +
    "</item>"
  );
}

test(
  "uses corruption-only search plan",
  async () => {
    const queries = [];

    const output =
      await searchGoogleNewsRssDetailed(
        subject(),
        {
          maxQueries: 4,

          fetchTextFn:
            async (endpoint) => {
              queries.push(
                endpoint
                  .searchParams
                  .get("q"),
              );

              return rss([]);
            },
        },
      );

    assert.equal(
      queries.length,
      4,
    );

    assert.equal(
      queries.some(
        (query) =>
          query.trim() ===
          "\"Савченко Антон Віталійович\"",
      ),
      false,
    );

    assert.equal(
      output.stats.requests,
      4,
    );
  },
);

test(
  "rejects ordinary non-corruption news",
  async () => {
    const output =
      await searchGoogleNewsRssDetailed(
        subject(),
        {
          maxQueries: 1,

          fetchTextFn:
            async () =>
              rss([
                item(
                  "Посадовець взяв участь у конференції",
                  "https://example.com/conference",
                  "Обговорили цифрову трансформацію.",
                ),
              ]),
        },
      );

    assert.equal(
      output.results.length,
      0,
    );

    assert.equal(
      output.stats
        .filtered_non_corruption,
      1,
    );
  },
);

test(
  "accepts corruption news",
  async () => {
    const output =
      await searchGoogleNewsRssDetailed(
        subject(),
        {
          maxQueries: 1,

          fetchTextFn:
            async () =>
              rss([
                item(
                  "Савченко Антон Віталійович — повідомлено про підозру",
                  "https://example.com/case",
                  "Працівник Національного агентства з питань запобігання корупції. НАБУ розслідує одержання неправомірної вигоди.",
                ),
              ]),
        },
      );

    assert.equal(
      output.results.length,
      1,
    );

    assert.equal(
      output.results[0]
        .corruptionRelevance
        .relevant,
      true,
    );
  },
);

test(
  "deduplicates same corruption article",
  async () => {
    const output =
      await searchGoogleNewsRssDetailed(
        subject(),
        {
          maxQueries: 2,

          fetchTextFn:
            async () =>
              rss([
                item(
                  "Савченко Антон Віталійович — НАБУ розслідує корупційне правопорушення",
                  "https://example.com/same-case",
                  "Працівник Національного агентства з питань запобігання корупції. Посадовцю повідомлено про підозру.",
                ),
              ]),
        },
      );

    assert.equal(
      output.results.length,
      1,
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
  "google news rejects corruption article about another person",
  async () => {
    const output =
      await searchGoogleNewsRssDetailed(
        subject(),
        {
          maxQueries: 1,

          fetchTextFn:
            async () =>
              rss([
                item(
                  "Петренко Іван Іванович отримав підозру",
                  "https://example.com/other-person",
                  "НАБУ розслідує неправомірну вигоду.",
                ),
              ]),
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
  "google news does not auto accept same full name without independent context",
  async () => {
    const output =
      await searchGoogleNewsRssDetailed(
        subject(),
        {
          maxQueries: 1,

          fetchTextFn:
            async () =>
              rss([
                item(
                  "Савченко Антон Віталійович",
                  "https://example.com/name-only",
                  "НАБУ розслідує хабар.",
                ),
              ]),
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
      output.rejected_identity[0]
        .mediaIdentity
        .level,
      "probable",
    );
  },
);
