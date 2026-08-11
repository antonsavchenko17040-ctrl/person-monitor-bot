import {
  normalizeText,
} from "./utils.js";

export const MEDIA_CORRUPTION_ROLE_VERSION =
  "media-corruption-role-v1";

export const MEDIA_CORRUPTION_ROLES =
  Object.freeze({
    ADVERSE_CONTEXT:
      "adverse_context",

    ANTI_CORRUPTION_ACTIVITY:
      "anti_corruption_activity",

    RELATED_MENTION:
      "related_mention",
  });

const ADVERSE_PATTERNS =
  Object.freeze([
    [
      "підозра",
      [
        "підозр",
        "подозр",
        "suspicion",
      ],
    ],
    [
      "обвинувачення",
      [
        "обвинувачен",
        "обвинен",
        "charged",
      ],
    ],
    [
      "хабар",
      [
        "хабар",
        "взятк",
        "bribe",
        "bribery",
      ],
    ],
    [
      "неправомірна вигода",
      [
        "неправомірн вигод",
        "неправомерн выгод",
      ],
    ],
    [
      "незаконне збагачення",
      [
        "незаконн збагачен",
        "незаконн обогащен",
        "illegal enrichment",
      ],
    ],
    [
      "вирок",
      [
        "вирок",
        "приговор",
        "conviction",
      ],
    ],
    [
      "засудження",
      [
        "засуджен",
        "осужден",
      ],
    ],
  ]);

const ANTI_CORRUPTION_PATTERNS =
  Object.freeze([
    [
      "співпраця",
      [
        "співпрац",
        "сотрудничеств",
        "cooperation",
      ],
    ],
    [
      "запобігання корупції",
      [
        "запобіган корупц",
        "предотвращен коррупц",
        "corruption prevention",
      ],
    ],
    [
      "протидія корупції",
      [
        "протид корупц",
        "противодейств коррупц",
        "counter corruption",
      ],
    ],
    [
      "антикорупційна діяльність",
      [
        "антикорупц",
        "anti corruption",
      ],
    ],
  ]);

function words(
  value,
) {
  return normalizeText(
    value,
  )
    .split(" ")
    .filter(Boolean);
}

function wordStem(
  word,
) {
  const value =
    words(
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
    words(
      expected,
    )[0] ?? "";

  const right =
    words(
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
      wordStem(
        left,
      ),
    )
  );
}

function subjectNames(
  subject,
) {
  const candidates = [
    subject?.full_name,

    ...(
      Array.isArray(
        subject?.aliases,
      )
        ? subject.aliases
        : []
    ),
  ];

  return candidates
    .map(
      (value) =>
        String(
          value ?? "",
        )
          .trim(),
    )
    .filter(
      (value) =>
        words(
          value,
        ).length >= 2,
    );
}

function containsSubject(
  text,
  subject,
) {
  const actualWords =
    words(
      text,
    );

  return subjectNames(
    subject,
  ).some(
    (name) =>
      words(
        name,
      ).every(
        (expected) =>
          actualWords.some(
            (actual) =>
              tokenMatches(
                expected,
                actual,
              ),
          ),
      ),
  );
}

function containsOtherPersonLikeName(
  text,
  subject,
) {
  if (
    containsSubject(
      text,
      subject,
    )
  ) {
    return false;
  }

  const value =
    String(
      text ?? "",
    )
      .normalize("NFC");

  const personLikeName =
    /(?:^|[^\p{L}])(\p{Lu}\p{Ll}{2,}(?:[-’\x27\p{L}]*)\s+\p{Lu}\p{Ll}{2,}(?:[-’\x27\p{L}]*))/gu;

  return personLikeName.test(
    value,
  );
}

function splitClauses(
  text,
) {
  return String(
    text ?? "",
  )
    .normalize("NFC")
    .split(
      /(?:[.!?]+\s+|[,;\n]+|\s+[—–]\s+|\s+(?:але|однак|проте|а)\s+)/giu,
    )
    .map(
      (value) =>
        value.trim(),
    )
    .filter(Boolean);
}

function matchesVariant(
  text,
  variant,
) {
  const textWords =
    words(
      text,
    );

  const tokens =
    words(
      variant,
    );

  if (
    !tokens.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <=
      textWords.length -
        tokens.length;
    index += 1
  ) {
    const matched =
      tokens.every(
        (token, offset) =>
          textWords[
            index + offset
          ].startsWith(
            token,
          ),
      );

    if (
      matched
    ) {
      return true;
    }
  }

  return false;
}

function matchedSignals(
  text,
  patterns,
) {
  return patterns
    .filter(
      ([, variants]) =>
        variants.some(
          (variant) =>
            matchesVariant(
              text,
              variant,
            ),
        ),
    )
    .map(
      ([label]) =>
        label,
    );
}

function uniqueSignals(
  values,
) {
  return [
    ...new Set(
      values,
    ),
  ];
}

export function classifyMediaCorruptionRole(
  subject,
  contextText,
) {
  const clauses =
    splitClauses(
      contextText,
    );

  const subjectClauseIndexes =
    clauses
      .map(
        (clause, index) =>
          containsSubject(
            clause,
            subject,
          )
            ? index
            : -1,
      )
      .filter(
        (index) =>
          index >= 0,
      );

  const subjectClauses =
    subjectClauseIndexes
      .map(
        (index) =>
          clauses[index],
      );

  const activityClauseIndexes =
    [
      ...new Set(
        subjectClauseIndexes
          .flatMap(
            (index) => [
              index - 2,
              index - 1,
              index,
              index + 1,
              index + 2,
            ],
          )
          .filter(
            (index) =>
              index >= 0 &&
              index <
                clauses.length,
          ),
      ),
    ];

  const activityClauses =
    activityClauseIndexes
      .filter(
        (index) =>
          subjectClauseIndexes.includes(
            index,
          ) ||
          !containsOtherPersonLikeName(
            clauses[index],
            subject,
          ),
      )
      .map(
        (index) =>
          clauses[index],
      );

  const adverseSignals =
    uniqueSignals(
      subjectClauses.flatMap(
        (clause) =>
          matchedSignals(
            clause,
            ADVERSE_PATTERNS,
          ),
      ),
    );

  if (
    adverseSignals.length
  ) {
    return {
      version:
        MEDIA_CORRUPTION_ROLE_VERSION,

      role:
        MEDIA_CORRUPTION_ROLES
          .ADVERSE_CONTEXT,

      signals:
        adverseSignals,

      wrongdoing_inferred:
        false,
    };
  }

  const activitySignals =
    uniqueSignals(
      activityClauses.flatMap(
        (clause) =>
          matchedSignals(
            clause,
            ANTI_CORRUPTION_PATTERNS,
          ),
      ),
    );

  if (
    activitySignals.length
  ) {
    return {
      version:
        MEDIA_CORRUPTION_ROLE_VERSION,

      role:
        MEDIA_CORRUPTION_ROLES
          .ANTI_CORRUPTION_ACTIVITY,

      signals:
        activitySignals,

      wrongdoing_inferred:
        false,
    };
  }

  return {
    version:
      MEDIA_CORRUPTION_ROLE_VERSION,

    role:
      MEDIA_CORRUPTION_ROLES
        .RELATED_MENTION,

    signals: [],

    wrongdoing_inferred:
      false,
  };
}
