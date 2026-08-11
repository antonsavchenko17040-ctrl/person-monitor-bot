import {
  normalizeText,
  tokenize,
} from "./utils.js";

export const MEDIA_IDENTITY_VERSION =
  "media-identity-v1";

function stemToken(token) {
  const value =
    normalizeText(token);

  if (value.length <= 5) {
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

function words(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

function wordMatches(
  token,
  candidate,
) {
  const normalized =
    normalizeText(token);

  const compared =
    normalizeText(candidate);

  if (
    !normalized ||
    !compared
  ) {
    return false;
  }

  return (
    compared === normalized ||
    compared.startsWith(
      stemToken(normalized),
    )
  );
}

function containsAllNameTokens(
  field,
  name,
) {
  const fieldWords =
    words(field);

  const nameTokens =
    tokenize(name);

  if (
    nameTokens.length < 3
  ) {
    return false;
  }

  return nameTokens.every(
    (token) =>
      fieldWords.some(
        (candidate) =>
          wordMatches(
            token,
            candidate,
          ),
      ),
  );
}

function containsOrderedName(
  field,
  name,
) {
  const normalizedField =
    normalizeText(field);

  const normalizedName =
    normalizeText(name);

  return Boolean(
    normalizedField &&
    normalizedName &&
    normalizedField.includes(
      normalizedName,
    )
  );
}

function contextMatchCount(
  context,
  field,
) {
  if (!context) {
    return 0;
  }

  const fieldWords =
    words(field);

  return tokenize(context)
    .filter(
      (token) =>
        token.length >= 4,
    )
    .filter(
      (token) =>
        fieldWords.some(
          (candidate) =>
            wordMatches(
              token,
              candidate,
            ),
        ),
    )
    .length;
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
      /[’\x27`]/g,
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

function identityTokenMatches(
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

  if (left === right) {
    return true;
  }

  const stemLength =
    Math.max(
      5,
      left.length - 2,
    );

  return right.startsWith(
    left.slice(
      0,
      stemLength,
    ),
  );
}

function isPatronymic(
  word,
) {
  const normalized =
    identityWords(
      word,
    )[0] ?? "";

  return /(?:ович|евич|євич|йович|івна|ївна|овна|евна)$/u
    .test(
      normalized,
    );
}

function conflictingPatronymic(
  subject,
  title,
) {
  const target =
    identityWords(
      subject?.full_name,
    );

  if (
    target.length < 3
  ) {
    return null;
  }

  const [
    surname,
    givenName,
    patronymic,
  ] = target;

  const titleWords =
    identityWords(
      title,
    );

  const hasSurname =
    titleWords.some(
      (word) =>
        identityTokenMatches(
          surname,
          word,
        ),
    );

  const hasGivenName =
    titleWords.some(
      (word) =>
        identityTokenMatches(
          givenName,
          word,
        ),
    );

  if (
    !hasSurname ||
    !hasGivenName
  ) {
    return null;
  }

  const patronymics =
    titleWords.filter(
      isPatronymic,
    );

  if (!patronymics.length) {
    return null;
  }

  const targetPresent =
    patronymics.some(
      (word) =>
        identityTokenMatches(
          patronymic,
          word,
        ),
    );

  if (targetPresent) {
    return null;
  }

  return patronymics[0];
}

function nameEvidenceScore(
  subject,
  result,
) {
  const title =
    result?.title ?? "";

  const snippet =
    result?.snippet ?? "";

  const fullName =
    subject?.full_name ?? "";

  const candidates = [];

  if (
    containsOrderedName(
      title,
      fullName,
    ) ||
    containsAllNameTokens(
      title,
      fullName,
    )
  ) {
    candidates.push({
      score: 70,
      reason:
        "повний ПІБ виявлено в заголовку",
      field:
        "title",
    });
  }

  if (
    containsOrderedName(
      snippet,
      fullName,
    )
  ) {
    candidates.push({
      score: 55,
      reason:
        "точний ПІБ виявлено у фрагменті матеріалу",
      field:
        "snippet",
    });
  } else if (
    containsAllNameTokens(
      snippet,
      fullName,
    )
  ) {
    candidates.push({
      score: 50,
      reason:
        "усі частини ПІБ виявлено у фрагменті матеріалу",
      field:
        "snippet",
    });
  }

  for (
    const alias
    of subject?.aliases ?? []
  ) {
    const aliasTokens =
      tokenize(alias);

    if (
      containsOrderedName(
        title,
        alias,
      )
    ) {
      candidates.push({
        score:
          aliasTokens.length >= 3
            ? 65
            : 30,

        reason:
          "альтернативне написання ПІБ у заголовку: " +
          alias,

        field:
          "title",
      });
    }

    if (
      containsOrderedName(
        snippet,
        alias,
      )
    ) {
      candidates.push({
        score:
          aliasTokens.length >= 3
            ? 50
            : 20,

        reason:
          "альтернативне написання ПІБ у фрагменті: " +
          alias,

        field:
          "snippet",
      });
    }
  }

  candidates.sort(
    (left, right) =>
      right.score -
      left.score,
  );

  return (
    candidates[0] ?? {
      score: 0,
      reason:
        "ПІБ суб’єкта не виявлено",
      field:
        null,
    }
  );
}

export function assessMediaIdentity(
  subject,
  result,
) {
  const reasons = [];

  const conflict =
    conflictingPatronymic(
      subject,
      result?.title,
    );

  if (conflict) {
    return {
      version:
        MEDIA_IDENTITY_VERSION,

      score: 0,
      level:
        "rejected",

      auto_accept:
        false,

      hard_conflict:
        true,

      reasons: [
        "у заголовку виявлено інше по батькові: " +
          conflict,
      ],

      evidence: {
        name_field:
          "title",

        organization_matches:
          0,

        position_matches:
          0,

        city_matches:
          0,
      },
    };
  }

  const nameEvidence =
    nameEvidenceScore(
      subject,
      result,
    );

  let score =
    nameEvidence.score;

  reasons.push(
    nameEvidence.reason,
  );

  const context =
    [
      result?.title,
      result?.snippet,
    ]
      .filter(Boolean)
      .join(" ");

  const organizationMatches =
    contextMatchCount(
      subject?.organization,
      context,
    );

  if (
    organizationMatches >= 2
  ) {
    score += 20;

    reasons.push(
      "збіг організації",
    );
  } else if (
    organizationMatches === 1
  ) {
    score += 10;

    reasons.push(
      "частковий збіг організації",
    );
  }

  const positionMatches =
    contextMatchCount(
      subject?.position,
      context,
    );

  if (
    positionMatches >= 2
  ) {
    score += 15;

    reasons.push(
      "збіг посади",
    );
  } else if (
    positionMatches === 1
  ) {
    score += 7;

    reasons.push(
      "частковий збіг посади",
    );
  }

  const cityMatches =
    contextMatchCount(
      subject?.city,
      context,
    );

  if (
    cityMatches >= 1
  ) {
    score += 5;

    reasons.push(
      "збіг міста або регіону",
    );
  }

  score =
    Math.max(
      0,
      Math.min(
        100,
        score,
      ),
    );

  const strongIndependentContext =
    organizationMatches >= 2 ||
    positionMatches >= 3;

  const level =
    score >= 85 &&
    strongIndependentContext
      ? "confirmed"
      : score >= 70
        ? "probable"
        : score >= 55
          ? "possible"
          : "rejected";

  return {
    version:
      MEDIA_IDENTITY_VERSION,

    score,
    level,

    auto_accept:
      level ===
      "confirmed",

    hard_conflict:
      false,

    reasons,

    evidence: {
      name_field:
        nameEvidence.field,

      organization_matches:
        organizationMatches,

      position_matches:
        positionMatches,

      city_matches:
        cityMatches,
    },
  };
}

export function isConfirmedMediaIdentity(
  subject,
  result,
) {
  return (
    assessMediaIdentity(
      subject,
      result,
    ).level ===
    "confirmed"
  );
}
