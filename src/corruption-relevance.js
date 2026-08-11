import {
  normalizeText,
} from "./utils.js";

export const CORRUPTION_RELEVANCE_VERSION =
  "corruption-relevance-v1";

const DIRECT_PATTERNS = Object.freeze([
  ["корупція", ["корупц"]],
  ["хабар", ["хабар", "взятк", "bribe", "bribery"]],
  ["неправомірна вигода", ["неправомірн вигод", "неправомерн выгод"]],
  ["підкуп", ["підкуп", "подкуп"]],
  ["торгівля впливом", ["торгівл вплив", "торговл влияни"]],
  ["незаконне збагачення", ["незаконн збагачен", "незаконн обогащен", "illegal enrichment"]],
  ["необґрунтовані активи", ["необґрунтован актив", "необоснованн актив"]],
  ["конфлікт інтересів", ["конфлікт інтерес", "конфликт интерес"]],
  ["недостовірне декларування", ["недостовірн деклар", "недостоверн деклар"]],
  ["зловживання службовим становищем", ["зловживан службов", "злоупотреблен служебн"]],
  ["службове підроблення", ["службов підроблен", "служебн подлог"]],
  ["привласнення", ["привласнен"]],
  ["розтрата", ["розтрат", "embezzlement"]],
]);

const AGENCY_PATTERNS = Object.freeze([
  ["НАБУ", ["набу", "nabu"]],
  ["САП", ["сап", "sapo"]],
  ["ВАКС", ["вакс", "hacc"]],
  ["НАЗК", ["назк", "nacp"]],
  ["антикорупційний орган", ["антикорупц"]],
]);

const PROCEDURE_PATTERNS = Object.freeze([
  ["підозра", ["підозр", "подозр", "suspicion"]],
  ["обвинувальний акт", ["обвинувальн акт", "обвинительн акт", "indictment"]],
  ["обвинувачення", ["обвинувачен", "обвинен", "charged"]],
  ["розслідування", ["розслідуван", "расследован", "investigation"]],
  ["кримінальне провадження", ["кримінальн проваджен", "уголовн производств"]],
  ["вирок", ["вирок", "приговор", "conviction"]],
  ["затримання", ["затриман", "задержан", "detained"]],
  ["обшук", ["обшук", "обыск", "searches"]],
  ["арешт активів", ["арешт актив", "арест актив"]],
]);

function haystackFromResult(result) {
  return normalizeText(
    [
      result?.title,
      result?.snippet,
      result?.source,
      result?.url,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function matchesPattern(text, variants) {
  const words =
    normalizeText(text)
      .split(" ")
      .filter(Boolean);

  return variants.some(
    (variant) => {
      const tokens =
        normalizeText(variant)
          .split(" ")
          .filter(Boolean);

      if (!tokens.length) {
        return false;
      }

      for (
        let index = 0;
        index <=
          words.length -
            tokens.length;
        index += 1
      ) {
        const matched =
          tokens.every(
            (token, offset) =>
              words[
                index + offset
              ].startsWith(
                token,
              ),
          );

        if (matched) {
          return true;
        }
      }

      return false;
    },
  );
}

function matchedLabels(
  text,
  patterns,
) {
  return patterns
    .filter(
      ([, variants]) =>
        matchesPattern(
          text,
          variants,
        ),
    )
    .map(
      ([label]) =>
        label,
    );
}

export function assessCorruptionRelevance(
  result,
) {
  const haystack =
    haystackFromResult(result);

  const title =
    normalizeText(
      result?.title,
    );

  const snippet =
    normalizeText(
      result?.snippet,
    );

  const direct =
    matchedLabels(
      haystack,
      DIRECT_PATTERNS,
    );

  const directInTitle =
    matchedLabels(
      title,
      DIRECT_PATTERNS,
    );

  const directInSnippet =
    matchedLabels(
      snippet,
      DIRECT_PATTERNS,
    );

  const agencyWords =
    normalizeText(
      haystack,
    )
      .split(" ")
      .filter(Boolean);

  const agencies =
    AGENCY_PATTERNS
      .filter(
        ([label, variants]) =>
          variants.some(
            (variant) => {
              const normalized =
                normalizeText(
                  variant,
                );

              if (
                [
                  "набу",
                  "nabu",
                  "сап",
                  "sapo",
                  "вакс",
                  "hacc",
                  "назк",
                  "nacp",
                ].includes(
                  normalized,
                )
              ) {
                return agencyWords.includes(
                  normalized,
                );
              }

              return matchesPattern(
                haystack,
                [
                  variant,
                ],
              );
            },
          ),
      )
      .map(
        ([label]) =>
          label,
      );

  const procedures =
    matchedLabels(
      haystack,
      PROCEDURE_PATTERNS,
    );

  const strongDirect =
    direct.filter(
      (label) =>
        label !==
        "корупція",
    );

  const genericCorruptionInTitle =
    directInTitle.includes(
      "корупція",
    );

  const genericCorruptionWithContext =
    directInSnippet.includes(
      "корупція",
    ) &&
    (
      agencies.length > 0 ||
      procedures.length > 0
    );

  if (
    strongDirect.length ||
    genericCorruptionInTitle ||
    genericCorruptionWithContext
  ) {
    return {
      version:
        CORRUPTION_RELEVANCE_VERSION,

      relevant: true,
      classification: "direct",

      direct_terms:
        direct,

      agencies,
      procedures,

      reasons: [
        strongDirect.length
          ? "виявлено сильну пряму корупційну ознаку"
          : genericCorruptionInTitle
            ? "корупційний контекст прямо в заголовку"
            : "згадка корупції підтверджена додатковим антикорупційним або процесуальним контекстом",
      ],
    };
  }

  if (
    agencies.length &&
    procedures.length
  ) {
    return {
      version:
        CORRUPTION_RELEVANCE_VERSION,

      relevant: true,
      classification: "related",

      direct_terms: [],
      agencies,
      procedures,

      reasons: [
        "антикорупційний орган згадується разом із процесуальною ознакою",
      ],
    };
  }

  return {
    version:
      CORRUPTION_RELEVANCE_VERSION,

    relevant: false,
    classification:
      "not_corruption",

    direct_terms: [],
    agencies,
    procedures,

    reasons: [
      "достатніх ознак корупційного контексту не виявлено",
    ],
  };
}

export function isCorruptionRelevant(
  result,
) {
  return assessCorruptionRelevance(
    result,
  ).relevant;
}
