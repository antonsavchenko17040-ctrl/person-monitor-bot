export const ARTICLE_TEXT_VERSION =
  "article-text-v1";

export const ARTICLE_TEXT_LIMITS =
  Object.freeze({
    maxInputChars:
      1_000_000,

    maxOutputChars:
      100_000,
  });

function positiveLimit(
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

function decodeEntities(
  value,
) {
  return String(value ?? "")
    .replace(
      /&#(\d+);/g,
      (_, code) => {
        const point =
          Number(code);

        return Number.isSafeInteger(point)
          ? String.fromCodePoint(point)
          : "";
      },
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code) => {
        const point =
          Number.parseInt(
            code,
            16,
          );

        return Number.isSafeInteger(point)
          ? String.fromCodePoint(point)
          : "";
      },
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "\x27")
    .replaceAll("&apos;", "\x27")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function removeIgnoredBlocks(
  html,
) {
  return String(html ?? "")
    .replace(
      /<(script|style|noscript|svg|canvas|nav|footer|header|aside|form|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(
      /<!--[\s\S]*?-->/g,
      " ",
    );
}

function firstElementContent(
  html,
  tag,
) {
  const pattern =
    new RegExp(
      "<" +
        tag +
        "\\b[^>]*>" +
        "([\\s\\S]*?)" +
        "</" +
        tag +
        "\\s*>",
      "i",
    );

  const match =
    String(html ?? "")
      .match(pattern);

  return match
    ? match[1]
    : null;
}

function selectMainContent(
  html,
) {
  return (
    firstElementContent(
      html,
      "article",
    ) ??
    firstElementContent(
      html,
      "main",
    ) ??
    firstElementContent(
      html,
      "body",
    ) ??
    html
  );
}

function htmlToText(
  html,
) {
  return decodeEntities(
    String(html ?? "")
      .replace(
        /<(br|hr)\b[^>]*\/?>/gi,
        "\n",
      )
      .replace(
        /<\/(p|div|section|article|main|li|h[1-6]|blockquote|tr)>/gi,
        "\n",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      ),
  )
    .replace(
      /\r/g,
      "",
    )
    .split("\n")
    .map(
      (line) =>
        line
          .replace(
            /[ \t]+/g,
            " ",
          )
          .trim(),
    )
    .filter(Boolean)
    .join("\n")
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}

export function extractArticleText(
  html,
  {
    maxInputChars =
      ARTICLE_TEXT_LIMITS
        .maxInputChars,

    maxOutputChars =
      ARTICLE_TEXT_LIMITS
        .maxOutputChars,
  } = {},
) {
  const inputLimit =
    positiveLimit(
      maxInputChars,
      ARTICLE_TEXT_LIMITS
        .maxInputChars,
    );

  const outputLimit =
    positiveLimit(
      maxOutputChars,
      ARTICLE_TEXT_LIMITS
        .maxOutputChars,
    );

  const raw =
    String(html ?? "");

  if (!raw.trim()) {
    return {
      version:
        ARTICLE_TEXT_VERSION,

      text: "",

      stats: {
        input_chars: 0,
        processed_input_chars: 0,
        output_chars: 0,
        input_truncated: false,
        output_truncated: false,
      },
    };
  }

  const boundedInput =
    raw.slice(
      0,
      inputLimit,
    );

  const cleaned =
    removeIgnoredBlocks(
      boundedInput,
    );

  const selected =
    selectMainContent(
      cleaned,
    );

  const extracted =
    htmlToText(
      selected,
    );

  const outputTruncated =
    extracted.length >
    outputLimit;

  const text =
    extracted.slice(
      0,
      outputLimit,
    );

  return {
    version:
      ARTICLE_TEXT_VERSION,

    text,

    stats: {
      input_chars:
        raw.length,

      processed_input_chars:
        boundedInput.length,

      output_chars:
        text.length,

      input_truncated:
        raw.length >
        inputLimit,

      output_truncated:
        outputTruncated,
    },
  };
}
