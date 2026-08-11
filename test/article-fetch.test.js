import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTICLE_FETCH_VERSION,
  ARTICLE_FETCH_LIMITS,
  validateArticleUrl,
  validateArticleDns,
  createPinnedLookup,
  fetchArticleHtml,
} from "../src/article-fetch.js";

const publicLookup =
  async () => [
    {
      address:
        "93.184.216.34",

      family:
        4,
    },
  ];

function response(
  body,
  {
    status = 200,
    headers = {},
  } = {},
) {
  return new Response(
    body,
    {
      status,
      headers,
    },
  );
}

test(
  "exports article fetch version and limits",
  () => {
    assert.equal(
      ARTICLE_FETCH_VERSION,
      "article-fetch-v1",
    );

    assert.equal(
      ARTICLE_FETCH_LIMITS
        .maxBytes,
      1_000_000,
    );
  },
);

test(
  "accepts public HTTP and HTTPS URLs",
  () => {
    assert.equal(
      validateArticleUrl(
        "https://example.com/news",
      ).hostname,
      "example.com",
    );

    assert.equal(
      validateArticleUrl(
        "http://example.com/news",
      ).protocol,
      "http:",
    );
  },
);

test(
  "rejects unsupported URL schemes",
  () => {
    assert.throws(
      () =>
        validateArticleUrl(
          "file:///etc/passwd",
        ),
      /HTTP або HTTPS/,
    );
  },
);

test(
  "rejects localhost and private IPv4",
  () => {
    assert.throws(
      () =>
        validateArticleUrl(
          "http://localhost/test",
        ),
      /Локальна адреса/,
    );

    assert.throws(
      () =>
        validateArticleUrl(
          "http://127.0.0.1/test",
        ),
      /Приватна IPv4/,
    );

    assert.throws(
      () =>
        validateArticleUrl(
          "http://192.168.1.1/test",
        ),
      /Приватна IPv4/,
    );
  },
);

test(
  "rejects private IPv6",
  () => {
    assert.throws(
      () =>
        validateArticleUrl(
          "http://[::1]/test",
        ),
      /Приватна IPv6/,
    );
  },
);

test(
  "fetches HTML with bounded metadata",
  async () => {
    const output =
      await fetchArticleHtml(
        "https://example.com/news",
        {
          lookupFn:
            publicLookup,

          fetchFn:
            async () =>
              response(
                "<html><article>Текст</article></html>",
                {
                  headers: {
                    "content-type":
                      "text/html; charset=utf-8",
                  },
                },
              ),
        },
      );

    assert.match(
      output.html,
      /Текст/,
    );

    assert.equal(
      output.metadata
        .redirects,
      0,
    );

    assert.ok(
      output.metadata.bytes >
      0,
    );
  },
);

test(
  "rejects non HTML response",
  async () => {
    await assert.rejects(
      () =>
        fetchArticleHtml(
          "https://example.com/file.pdf",
          {
            lookupFn:
            publicLookup,

          fetchFn:
              async () =>
                response(
                  "PDF",
                  {
                    headers: {
                      "content-type":
                        "application/pdf",
                    },
                  },
                ),
          },
        ),
      /не є HTML/,
    );
  },
);

test(
  "rejects oversized content length before body read",
  async () => {
    await assert.rejects(
      () =>
        fetchArticleHtml(
          "https://example.com/huge",
          {
            maxBytes:
              100,

            lookupFn:
            publicLookup,

          fetchFn:
              async () =>
                response(
                  "small",
                  {
                    headers: {
                      "content-type":
                        "text/html",

                      "content-length":
                        "1000",
                    },
                  },
                ),
          },
        ),
      /перевищує дозволений розмір/,
    );
  },
);

test(
  "rejects body that exceeds byte limit",
  async () => {
    await assert.rejects(
      () =>
        fetchArticleHtml(
          "https://example.com/huge",
          {
            maxBytes:
              20,

            lookupFn:
            publicLookup,

          fetchFn:
              async () =>
                response(
                  "X".repeat(
                    100,
                  ),
                  {
                    headers: {
                      "content-type":
                        "text/html",
                    },
                  },
                ),
          },
        ),
      /перевищує дозволений розмір/,
    );
  },
);

test(
  "follows validated relative redirect",
  async () => {
    const calls = [];

    const output =
      await fetchArticleHtml(
        "https://example.com/start",
        {
          lookupFn:
            publicLookup,

          fetchFn:
            async (
              url,
            ) => {
              calls.push(
                url,
              );

              if (
                calls.length ===
                1
              ) {
                return response(
                  null,
                  {
                    status:
                      302,

                    headers: {
                      location:
                        "/article",
                    },
                  },
                );
              }

              return response(
                "<html>Стаття</html>",
                {
                  headers: {
                    "content-type":
                      "text/html",
                  },
                },
              );
            },
        },
      );

    assert.equal(
      output.url,
      "https://example.com/article",
    );

    assert.equal(
      output.metadata
        .redirects,
      1,
    );
  },
);

test(
  "rejects redirect to private address",
  async () => {
    await assert.rejects(
      () =>
        fetchArticleHtml(
          "https://example.com/start",
          {
            lookupFn:
            publicLookup,

          fetchFn:
              async () =>
                response(
                  null,
                  {
                    status:
                      302,

                    headers: {
                      location:
                        "http://127.0.0.1/admin",
                    },
                  },
                ),
          },
        ),
      /Приватна IPv4/,
    );
  },
);

test(
  "rejects URL credentials",
  () => {
    assert.throws(
      () =>
        validateArticleUrl(
          "https://user:pass@example.com/news",
        ),
      /обліковими даними/,
    );
  },
);

test(
  "rejects hostname resolving to private IPv4 before fetch",
  async () => {
    let fetchCalled =
      false;

    await assert.rejects(
      () =>
        fetchArticleHtml(
          "https://example.com/news",
          {
            lookupFn:
              async () => [
                {
                  address:
                    "127.0.0.1",

                  family:
                    4,
                },
              ],

            fetchFn:
              async () => {
                fetchCalled =
                  true;

                return response(
                  "<html></html>",
                  {
                    headers: {
                      "content-type":
                        "text/html",
                    },
                  },
                );
              },
          },
        ),
      /DNS веде на приватну IPv4/,
    );

    assert.equal(
      fetchCalled,
      false,
    );
  },
);

test(
  "rejects hostname resolving to private IPv6",
  async () => {
    await assert.rejects(
      () =>
        validateArticleDns(
          "https://example.com/news",
          {
            lookupFn:
              async () => [
                {
                  address:
                    "::1",

                  family:
                    6,
                },
              ],
          },
        ),
      /DNS веде на приватну IPv6/,
    );

    await assert.rejects(
      () =>
        validateArticleDns(
          "https://example.com/news",
          {
            lookupFn:
              async () => [
                {
                  address:
                    "::ffff:127.0.0.1",

                  family:
                    6,
                },
              ],
          },
        ),
      /DNS веде на приватну IPv6/,
    );
  },
);

test(
  "revalidates DNS after redirect",
  async () => {
    let dnsCalls =
      0;

    let fetchCalls =
      0;

    await assert.rejects(
      () =>
        fetchArticleHtml(
          "https://example.com/start",
          {
            lookupFn:
              async () => {
                dnsCalls += 1;

                if (
                  dnsCalls === 1
                ) {
                  return [
                    {
                      address:
                        "93.184.216.34",

                      family:
                        4,
                    },
                  ];
                }

                return [
                  {
                    address:
                      "10.0.0.5",

                    family:
                      4,
                  },
                ];
              },

            fetchFn:
              async () => {
                fetchCalls += 1;

                return response(
                  null,
                  {
                    status:
                      302,

                    headers: {
                      location:
                        "https://internal.example/admin",
                    },
                  },
                );
              },
          },
        ),
      /DNS веде на приватну IPv4/,
    );

    assert.equal(
      dnsCalls,
      2,
    );

    assert.equal(
      fetchCalls,
      1,
    );
  },
);

test(
  "pins connection lookup to already validated addresses",
  async () => {
    const lookup =
      createPinnedLookup([
        {
          address:
            "93.184.216.34",

          family:
            4,
        },
        {
          address:
            "2606:2800:220:1:248:1893:25c8:1946",

          family:
            6,
        },
      ]);

    const ipv4 =
      await new Promise(
        (
          resolve,
          reject,
        ) => {
          lookup(
            "changed.example",
            {
              family:
                4,
            },
            (
              error,
              address,
              family,
            ) => {
              if (error) {
                reject(
                  error,
                );

                return;
              }

              resolve({
                address,
                family,
              });
            },
          );
        },
      );

    assert.deepEqual(
      ipv4,
      {
        address:
          "93.184.216.34",

        family:
          4,
      },
    );

    const all =
      await new Promise(
        (
          resolve,
          reject,
        ) => {
          lookup(
            "changed.example",
            {
              all:
                true,
            },
            (
              error,
              addresses,
            ) => {
              if (error) {
                reject(
                  error,
                );

                return;
              }

              resolve(
                addresses,
              );
            },
          );
        },
      );

    assert.equal(
      all.length,
      2,
    );
  },
);

test(
  "pinned lookup refuses private addresses defensively",
  () => {
    assert.throws(
      () =>
        createPinnedLookup([
          {
            address:
              "127.0.0.1",

            family:
              4,
          },
        ]),
      /приватну IPv4/,
    );

    assert.throws(
      () =>
        createPinnedLookup([
          {
            address:
              "::1",

            family:
              6,
          },
        ]),
      /приватну IPv6/,
    );
  },
);

