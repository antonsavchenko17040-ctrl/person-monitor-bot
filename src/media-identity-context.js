export const MEDIA_IDENTITY_CONTEXT_VERSION =
  "media-identity-context-v1";

export const MEDIA_IDENTITY_CONTEXT_LIMITS =
  Object.freeze({
    radius:
      600,

    maxMentions:
      5,

    maxChars:
      4000,
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

function identityWords(
  value,
) {
  return String(
    value ?? "",
  )
    .toLocaleLowerCase(
      "uk-UA",
    )
    .normalize("NFC")
    .replace(
      /[’\u0027`]/g,
      "",
    )
    .replace(
      /[^\p{L}\p{N}\s-]/gu,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .split(" ")
    .filter(Boolean);
}

function wordStem(
  word,
) {
  const value =
    identityWords(
      word,
    )[0] ?? "";

  if (
    value.length <= 5
  ) {
    return value;
  }

  return value.slice(
    0,
    Math.max(
      5,
      value.length - 2,
    ),
  );
}

function tokenMatches(
  expected,
  actual,
) {
  const left =
    identityWords(
      expected,
    )[0] ?? "";

  const right =
    identityWords(
      actual,
    )[0] ?? "";

  if (
    !left ||
    !right
  ) {
    return false;
  }

  return (
    right === left ||
    right.startsWith(
      wordStem(left),
    )
  );
}

function subjectNames(
  subject,
) {
  const candidates = [
    {
      value:
        subject?.full_name,

      minTokens:
        2,
    },

    ...(
      Array.isArray(
        subject?.aliases,
      )
        ? subject.aliases
        : []
    )
      .map(
        (value) => ({
          value,

          minTokens:
            3,
        }),
      ),
  ];

  const names =
    candidates
      .map(
        ({
          value,
          minTokens,
        }) => ({
          value:
            String(
              value ?? "",
            )
              .trim(),

          minTokens,
        }),
      )
      .filter(
        ({
          value,
          minTokens,
        }) =>
          identityWords(
            value,
          ).length >=
          minTokens,
      )
      .map(
        ({
          value,
        }) =>
          value,
      );

  const unique =
    new Map();

  for (
    const name
    of names
  ) {
    const key =
      identityWords(
        name,
      )
        .join(" ");

    if (
      key &&
      !unique.has(key)
    ) {
      unique.set(
        key,
        name,
      );
    }
  }

  return [
    ...unique.values(),
  ];
}

function containsTargetName(
  text,
  names,
) {
  const fieldWords =
    identityWords(
      text,
    );

  return names.some(
    (name) =>
      identityWords(
        name,
      )
        .every(
          (expected) =>
            fieldWords.some(
              (actual) =>
                tokenMatches(
                  expected,
                  actual,
                ),
            ),
        ),
  );
}

function anchorStems(
  names,
) {
  const stems =
    new Set();

  for (
    const name
    of names
  ) {
    for (
      const token
      of identityWords(
        name,
      )
    ) {
      if (
        token.length < 5
      ) {
        continue;
      }

      const stem =
        wordStem(
          token,
        );

      if (stem) {
        stems.add(
          stem,
        );
      }
    }
  }

  return [
    ...stems,
  ];
}

function emptyResult() {
  return {
    version:
      MEDIA_IDENTITY_CONTEXT_VERSION,

    text:
      "",

    stats: {
      mention_windows:
        0,

      context_chars:
        0,

      truncated:
        false,
    },
  };
}

export function extractMediaIdentityContext(
  subject,
  text,
  {
    radius =
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .radius,

    maxMentions =
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .maxMentions,

    maxChars =
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .maxChars,
  } = {},
) {
  const source =
    String(
      text ?? "",
    )
      .normalize("NFC");

  if (
    !source.trim()
  ) {
    return emptyResult();
  }

  const names =
    subjectNames(
      subject,
    );

  if (
    !names.length
  ) {
    return emptyResult();
  }

  const safeRadius =
    positiveInteger(
      radius,
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .radius,
    );

  const safeMaxMentions =
    positiveInteger(
      maxMentions,
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .maxMentions,
    );

  const safeMaxChars =
    positiveInteger(
      maxChars,
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .maxChars,
    );

  const searchText =
    source
      .toLocaleLowerCase(
        "uk-UA",
      );

  const anchors =
    anchorStems(
      names,
    );

  const ranges = [];

  for (
    const anchor
    of anchors
  ) {
    let from =
      0;

    while (
      from <
      searchText.length
    ) {
      const index =
        searchText.indexOf(
          anchor,
          from,
        );

      if (
        index < 0
      ) {
        break;
      }

      const start =
        Math.max(
          0,
          index -
            safeRadius,
        );

      const end =
        Math.min(
          source.length,
          index +
            anchor.length +
            safeRadius,
        );

      const candidate =
        source.slice(
          start,
          end,
        );

      if (
        containsTargetName(
          candidate,
          names,
        )
      ) {
        ranges.push({
          start,
          end,
        });
      }

      from =
        index +
        Math.max(
          1,
          anchor.length,
        );
    }
  }

  if (
    !ranges.length
  ) {
    return emptyResult();
  }

  ranges.sort(
    (left, right) =>
      left.start -
      right.start,
  );

  const merged = [];

  for (
    const range
    of ranges
  ) {
    const previous =
      merged[
        merged.length - 1
      ];

    if (
      previous &&
      range.start <=
        previous.end
    ) {
      previous.end =
        Math.max(
          previous.end,
          range.end,
        );

      continue;
    }

    merged.push({
      ...range,
    });
  }

  const selected =
    merged.slice(
      0,
      safeMaxMentions,
    );

  const joined =
    selected
      .map(
        (range) =>
          source.slice(
            range.start,
            range.end,
          ),
      )
      .join(
        "\n...\n",
      );

  const textOutput =
    joined.slice(
      0,
      safeMaxChars,
    );

  return {
    version:
      MEDIA_IDENTITY_CONTEXT_VERSION,

    text:
      textOutput,

    stats: {
      mention_windows:
        selected.length,

      context_chars:
        textOutput.length,

      truncated:
        merged.length >
          selected.length ||
        joined.length >
          safeMaxChars,
    },
  };
}
