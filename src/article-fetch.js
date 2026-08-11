import {
  isIP,
} from "node:net";

import {
  request as httpRequest,
} from "node:http";

import {
  request as httpsRequest,
} from "node:https";

import {
  Readable,
} from "node:stream";

import {
  lookup as dnsLookup,
} from "node:dns/promises";

export const ARTICLE_FETCH_VERSION =
  "article-fetch-v1";

export const ARTICLE_FETCH_LIMITS =
  Object.freeze({
    timeoutMs:
      15_000,

    maxBytes:
      1_000_000,

    maxRedirects:
      3,
  });

function positiveInteger(
  value,
  fallback,
) {
  const number =
    Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  )
    ? number
    : fallback;
}

function isPrivateIpv4(
  hostname,
) {
  const parts =
    hostname
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255,
    )
  ) {
    return false;
  }

  const [
    a,
    b,
  ] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 168
    )
  );
}

function isPrivateIpv6(
  hostname,
) {
  const value =
    hostname
      .toLowerCase()
      .replace(
        /^\[|\]$/g,
        "",
      );

  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("::ffff:") ||
    value.startsWith("ff") ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  );
}

export function validateArticleUrl(
  value,
) {
  let url;

  try {
    url =
      new URL(
        String(value ?? ""),
      );
  } catch {
    throw new Error(
      "Некоректний URL статті",
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Дозволено лише HTTP або HTTPS URL",
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "URL з обліковими даними не дозволено",
    );
  }

  const hostname =
    url.hostname
      .toLowerCase()
      .replace(
        /\.$/,
        "",
      );

  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(
      ".localhost",
    )
  ) {
    throw new Error(
      "Локальна адреса не дозволена",
    );
  }

  const ipHostname =
    hostname.startsWith("[") &&
    hostname.endsWith("]")
      ? hostname.slice(
          1,
          -1,
        )
      : hostname;

  const ipVersion =
    isIP(ipHostname);

  if (
    ipVersion === 4 &&
    isPrivateIpv4(
      ipHostname,
    )
  ) {
    throw new Error(
      "Приватна IPv4-адреса не дозволена",
    );
  }

  if (
    ipVersion === 6 &&
    isPrivateIpv6(
      ipHostname,
    )
  ) {
    throw new Error(
      "Приватна IPv6-адреса не дозволена",
    );
  }

  return url;
}

export async function validateArticleDns(
  value,
  {
    lookupFn =
      dnsLookup,
  } = {},
) {
  if (
    typeof lookupFn !==
    "function"
  ) {
    throw new TypeError(
      "lookupFn має бути функцією",
    );
  }

  const url =
    value instanceof URL
      ? value
      : validateArticleUrl(
          value,
        );

  const hostname =
    url.hostname
      .toLowerCase()
      .replace(
        /\.$/,
        "",
      );

  const ipHostname =
    hostname.startsWith("[") &&
    hostname.endsWith("]")
      ? hostname.slice(
          1,
          -1,
        )
      : hostname;

  const literalVersion =
    isIP(ipHostname);

  if (literalVersion) {
    return {
      hostname:
        ipHostname,

      addresses: [
        {
          address:
            ipHostname,

          family:
            literalVersion,
        },
      ],
    };
  }

  let resolved;

  try {
    resolved =
      await lookupFn(
        ipHostname,
        {
          all:
            true,

          verbatim:
            true,
        },
      );
  } catch (error) {
    throw new Error(
      "Не вдалося перевірити DNS адреси статті",
      {
        cause:
          error,
      },
    );
  }

  const records =
    Array.isArray(resolved)
      ? resolved
      : resolved
        ? [resolved]
        : [];

  if (!records.length) {
    throw new Error(
      "DNS не повернув IP-адресу",
    );
  }

  const addresses = [];

  for (
    const record
    of records
  ) {
    const address =
      String(
        record?.address ?? "",
      );

    const family =
      isIP(address);

    if (!family) {
      throw new Error(
        "DNS повернув некоректну IP-адресу",
      );
    }

    if (
      family === 4 &&
      isPrivateIpv4(
        address,
      )
    ) {
      throw new Error(
        "DNS веде на приватну IPv4-адресу",
      );
    }

    if (
      family === 6 &&
      isPrivateIpv6(
        address,
      )
    ) {
      throw new Error(
        "DNS веде на приватну IPv6-адресу",
      );
    }

    addresses.push({
      address,
      family,
    });
  }

  return {
    hostname:
      ipHostname,

    addresses,
  };
}

function normalizePinnedAddress(
  record,
) {
  const address =
    String(
      record?.address ?? "",
    );

  const family =
    isIP(
      address,
    );

  if (!family) {
    throw new Error(
      "Pinned DNS містить некоректну IP-адресу",
    );
  }

  if (
    family === 4 &&
    isPrivateIpv4(
      address,
    )
  ) {
    throw new Error(
      "Pinned DNS містить приватну IPv4-адресу",
    );
  }

  if (
    family === 6 &&
    isPrivateIpv6(
      address,
    )
  ) {
    throw new Error(
      "Pinned DNS містить приватну IPv6-адресу",
    );
  }

  return {
    address,
    family,
  };
}

export function createPinnedLookup(
  addresses,
) {
  const records =
    (
      Array.isArray(
        addresses,
      )
        ? addresses
        : []
    )
      .map(
        normalizePinnedAddress,
      );

  if (!records.length) {
    throw new Error(
      "Немає перевірених IP-адрес для зʼєднання",
    );
  }

  return (
    _hostname,
    options,
    callback,
  ) => {
    const requestedFamily =
      typeof options === "number"
        ? options
        : options?.family === 4 ||
            options?.family === "IPv4"
          ? 4
          : options?.family === 6 ||
              options?.family === "IPv6"
            ? 6
            : 0;

    const selected =
      requestedFamily
        ? records.filter(
            (record) =>
              record.family ===
              requestedFamily,
          )
        : records;

    if (!selected.length) {
      const error =
        new Error(
          "Немає перевіреної IP-адреси потрібної сімʼї",
        );

      error.code =
        "ENOTFOUND";

      callback(
        error,
      );

      return;
    }

    if (
      typeof options === "object" &&
      options?.all === true
    ) {
      callback(
        null,
        selected.map(
          (record) => ({
            address:
              record.address,

            family:
              record.family,
          }),
        ),
      );

      return;
    }

    callback(
      null,
      selected[0].address,
      selected[0].family,
    );
  };
}

function responseHeadersFromNode(
  headers,
) {
  const output =
    new Headers();

  for (
    const [
      name,
      value,
    ]
    of Object.entries(
      headers ?? {},
    )
  ) {
    if (
      Array.isArray(
        value,
      )
    ) {
      for (
        const item
        of value
      ) {
        output.append(
          name,
          String(item),
        );
      }

      continue;
    }

    if (
      value !== undefined
    ) {
      output.set(
        name,
        String(value),
      );
    }
  }

  return output;
}

function requestPinnedArticleResponse(
  url,
  {
    signal,
    headers,
    addresses,
  },
) {
  const requestFn =
    url.protocol === "https:"
      ? httpsRequest
      : httpRequest;

  const lookup =
    createPinnedLookup(
      addresses,
    );

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const request =
        requestFn(
          url,
          {
            method:
              "GET",

            headers,
            signal,
            lookup,
          },
          (
            incoming,
          ) => {
            const status =
              Number(
                incoming
                  .statusCode ??
                500,
              );

            if (
              status < 200 ||
              status > 599
            ) {
              incoming.destroy();

              reject(
                new Error(
                  "Некоректний HTTP status",
                ),
              );

              return;
            }

            const noBody =
              status === 204 ||
              status === 205 ||
              status === 304;

            const body =
              noBody
                ? null
                : Readable.toWeb(
                    incoming,
                  );

            try {
              resolve(
                new Response(
                  body,
                  {
                    status,

                    statusText:
                      incoming
                        .statusMessage ??
                      "",

                    headers:
                      responseHeadersFromNode(
                        incoming.headers,
                      ),
                  },
                ),
              );
            } catch (
              error
            ) {
              incoming.destroy();

              reject(
                error,
              );
            }
          },
        );

      request.once(
        "error",
        reject,
      );

      request.end();
    },
  );
}

function isHtmlContentType(
  value,
) {
  const type =
    String(value ?? "")
      .toLowerCase();

  return (
    type.includes(
      "text/html",
    ) ||
    type.includes(
      "application/xhtml+xml",
    )
  );
}

async function readBoundedBody(
  response,
  maxBytes,
) {
  if (
    response.body &&
    typeof response.body.getReader ===
      "function"
  ) {
    const reader =
      response.body
        .getReader();

    const chunks = [];
    let total = 0;

    try {
      while (true) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (done) {
          break;
        }

        const chunk =
          value instanceof Uint8Array
            ? value
            : new Uint8Array(
                value,
              );

        total +=
          chunk.byteLength;

        if (
          total >
          maxBytes
        ) {
          await reader
            .cancel()
            .catch(
              () => {},
            );

          throw new Error(
            "HTML перевищує дозволений розмір",
          );
        }

        chunks.push(
          chunk,
        );
      }
    } finally {
      reader
        .releaseLock?.();
    }

    const merged =
      new Uint8Array(
        total,
      );

    let offset = 0;

    for (
      const chunk
      of chunks
    ) {
      merged.set(
        chunk,
        offset,
      );

      offset +=
        chunk.byteLength;
    }

    return merged;
  }

  const buffer =
    new Uint8Array(
      await response
        .arrayBuffer(),
    );

  if (
    buffer.byteLength >
    maxBytes
  ) {
    throw new Error(
      "HTML перевищує дозволений розмір",
    );
  }

  return buffer;
}

export async function fetchArticleHtml(
  value,
  {
    fetchFn =
      null,

    timeoutMs =
      ARTICLE_FETCH_LIMITS
        .timeoutMs,

    maxBytes =
      ARTICLE_FETCH_LIMITS
        .maxBytes,

    maxRedirects =
      ARTICLE_FETCH_LIMITS
        .maxRedirects,

    lookupFn =
      dnsLookup,
  } = {},
) {
  if (
    fetchFn !== null &&
    typeof fetchFn !==
      "function"
  ) {
    throw new TypeError(
      "fetchFn має бути функцією",
    );
  }

  const timeout =
    positiveInteger(
      timeoutMs,
      ARTICLE_FETCH_LIMITS
        .timeoutMs,
    );

  const byteLimit =
    positiveInteger(
      maxBytes,
      ARTICLE_FETCH_LIMITS
        .maxBytes,
    );

  const redirectLimit =
    positiveInteger(
      maxRedirects,
      ARTICLE_FETCH_LIMITS
        .maxRedirects,
    );

  let currentUrl =
    validateArticleUrl(
      value,
    );

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeout,
    );

  try {
    for (
      let redirects = 0;
      redirects <=
        redirectLimit;
      redirects += 1
    ) {
      const dnsValidation =
        await validateArticleDns(
          currentUrl,
          {
            lookupFn,
          },
        );

      const requestHeaders = {
        accept:
          "text/html,application/xhtml+xml;q=0.9",

        "user-agent":
          "PersonMonitorBot/1.0 public-information-monitoring",
      };

      const response =
        fetchFn
          ? await fetchFn(
              currentUrl.href,
              {
                method:
                  "GET",

                redirect:
                  "manual",

                signal:
                  controller.signal,

                headers:
                  requestHeaders,
              },
            )
          : await requestPinnedArticleResponse(
              currentUrl,
              {
                signal:
                  controller.signal,

                headers:
                  requestHeaders,

                addresses:
                  dnsValidation
                    .addresses,
              },
            );

      if (
        response.status >= 300 &&
        response.status < 400
      ) {
        const location =
          response.headers
            .get(
              "location",
            );

        if (!location) {
          throw new Error(
            "Redirect без Location",
          );
        }

        if (
          redirects >=
          redirectLimit
        ) {
          throw new Error(
            "Перевищено ліміт redirect",
          );
        }

        currentUrl =
          validateArticleUrl(
            new URL(
              location,
              currentUrl,
            ).href,
          );

        continue;
      }

      if (
        !response.ok
      ) {
        throw new Error(
          "HTTP " +
          response.status,
        );
      }

      const contentType =
        response.headers
          .get(
            "content-type",
          );

      if (
        !isHtmlContentType(
          contentType,
        )
      ) {
        throw new Error(
          "Відповідь не є HTML",
        );
      }

      const contentLength =
        Number(
          response.headers
            .get(
              "content-length",
            ),
        );

      if (
        Number.isFinite(
          contentLength,
        ) &&
        contentLength >
          byteLimit
      ) {
        throw new Error(
          "HTML перевищує дозволений розмір",
        );
      }

      const bytes =
        await readBoundedBody(
          response,
          byteLimit,
        );

      const html =
        new TextDecoder(
          "utf-8",
        )
          .decode(
            bytes,
          );

      return {
        version:
          ARTICLE_FETCH_VERSION,

        url:
          currentUrl.href,

        html,

        metadata: {
          content_type:
            contentType,

          bytes:
            bytes.byteLength,

          redirects,
        },
      };
    }

    throw new Error(
      "Перевищено ліміт redirect",
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Перевищено час завантаження HTML",
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timer,
    );
  }
}
