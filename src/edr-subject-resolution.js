import {
  findActiveEdrSubjectCandidates,
} from "./edr-subject-search.js";

function candidateKey(candidate) {
  return [
    candidate?.candidateKind ?? "",
    candidate?.recordId ??
      candidate?.candidateId ??
      "",
    candidate?.snapshotId ?? "",
  ].join("|");
}

function uniqueCandidates(candidates) {
  const unique = new Map();

  for (const candidate of candidates) {
    const key = candidateKey(candidate);

    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return [...unique.values()];
}

function candidateReasons(candidate) {
  return Array.isArray(candidate?.reasons)
    ? candidate.reasons
    : [];
}

export function orchestrateEdrSubjectMatch(
  searchResult,
) {
  if (
    !searchResult ||
    !Array.isArray(searchResult.candidates)
  ) {
    throw new TypeError(
      "searchResult.candidates must be an array",
    );
  }

  const candidates =
    searchResult.candidates;

  const hardMatches =
    uniqueCandidates(
      candidates.filter(
        (candidate) =>
          candidate?.hardMatch === true &&
          candidate?.level === "confirmed" &&
          candidate?.conflict !== true,
      ),
    );

  const conflicts =
    uniqueCandidates(
      candidates.filter(
        (candidate) =>
          candidate?.conflict === true,
      ),
    );

  if (hardMatches.length > 1) {
    return {
      ...searchResult,
      status: "conflict",
      decision: "manual_review",
      best: null,
      hard_matches: hardMatches,
      conflicts,
      review_required: true,
      reasons: [
        "Стабільний ідентифікатор відповідає кільком записам ЄДР",
      ],
    };
  }

  if (hardMatches.length === 1) {
    const best = hardMatches[0];

    const reasons = [
      ...candidateReasons(best),
    ];

    if (conflicts.length > 0) {
      reasons.push(
        "Є суперечливі name-кандидати, але стабільний ідентифікатор має пріоритет",
      );
    }

    return {
      ...searchResult,
      status: "matched",
      decision:
        "exact_stable_identifier",
      best,
      hard_matches: hardMatches,
      conflicts,
      review_required: false,
      reasons,
    };
  }

  if (conflicts.length > 0) {
    return {
      ...searchResult,
      status: "conflict",
      decision: "manual_review",
      best:
        searchResult.best ??
        conflicts[0] ??
        null,
      hard_matches: [],
      conflicts,
      review_required: true,
      reasons: [
        "ЄДРПОУ суперечить кандидату, знайденому за назвою",
      ],
    };
  }

  if (
    searchResult.status ===
      "ambiguous" ||
    searchResult.decision ===
      "manual_review"
  ) {
    return {
      ...searchResult,
      status: "ambiguous",
      decision: "manual_review",
      hard_matches: [],
      conflicts: [],
      review_required: true,
      reasons:
        candidateReasons(
          searchResult.best,
        ).length > 0
          ? candidateReasons(
              searchResult.best,
            )
          : [
              "Недостатньо стабільних ідентифікаторів для автоматичного підтвердження",
            ],
    };
  }

  if (
    searchResult.status === "matched"
  ) {
    return {
      ...searchResult,
      status: "ambiguous",
      decision: "manual_review",
      hard_matches: [],
      conflicts: [],
      review_required: true,
      reasons: [
        "Автоматичний match без hard evidence заборонений",
      ],
    };
  }

  return {
    ...searchResult,
    status: "unmatched",
    decision: "no_match",
    hard_matches: [],
    conflicts: [],
    review_required: false,
    reasons:
      candidateReasons(
        searchResult.best,
      ).length > 0
        ? candidateReasons(
            searchResult.best,
          )
        : [
            "Кандидатів з достатнім рівнем доказів не знайдено",
          ],
  };
}

export async function resolveActiveEdrSubjectMatch(
  sql,
  input,
  options = {},
) {
  const findCandidates =
    options.findCandidates ??
    findActiveEdrSubjectCandidates;

  if (
    typeof findCandidates !==
    "function"
  ) {
    throw new TypeError(
      "findCandidates must be a function",
    );
  }

  const searchOptions = {
    ...options,
  };

  delete searchOptions.findCandidates;

  const searchResult =
    await findCandidates(
      sql,
      input,
      searchOptions,
    );

  return orchestrateEdrSubjectMatch(
    searchResult,
  );
}
