import {
  textSimilarity,
} from "./entity-resolution.js";

import {
  normalizeEdrLookupText,
} from "./edr-import-shape.js";

export const EDR_SUBJECT_MATCH_LEVELS =
  Object.freeze({
    CONFIRMED: "confirmed",
    PROBABLE: "probable",
    POSSIBLE: "possible",
    REJECTED: "rejected",
  });

const RECORD_TYPES =
  new Set([
    "organization",
    "fop",
  ]);

const RELATION_TYPES =
  new Set([
    "founder",
    "beneficiary",
    "signer",
    "member",
    "executive_power",
    "superior_management",
    "branch",
    "predecessor",
    "assignee",
  ]);

function normalizeCode(value) {
  if (value == null) {
    return null;
  }

  return (
    String(value).trim() ||
    null
  );
}

function candidateLevel(score) {
  if (score >= 85) {
    return EDR_SUBJECT_MATCH_LEVELS.CONFIRMED;
  }

  if (score >= 70) {
    return EDR_SUBJECT_MATCH_LEVELS.PROBABLE;
  }

  if (score >= 55) {
    return EDR_SUBJECT_MATCH_LEVELS.POSSIBLE;
  }

  return EDR_SUBJECT_MATCH_LEVELS.REJECTED;
}

function requireRecordType(value) {
  const recordType =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (!RECORD_TYPES.has(recordType)) {
    throw new TypeError(
      `Unsupported EDR record type: ${recordType || "empty"}`,
    );
  }

  return recordType;
}

function requireRelationType(value) {
  const relationType =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (!RELATION_TYPES.has(relationType)) {
    throw new TypeError(
      `Unsupported EDR relation type: ${relationType || "empty"}`,
    );
  }

  return relationType;
}

function inputName(input) {
  return normalizeEdrLookupText(
    input?.fullName ??
    input?.name ??
    null,
  );
}

function nameScore(
  subjectName,
  candidateName,
  {
    exactScore,
    fuzzyMax = 60,
  },
) {
  if (!subjectName || !candidateName) {
    return {
      score: 0,
      similarity: 0,
      exact: false,
    };
  }

  if (subjectName === candidateName) {
    return {
      score: exactScore,
      similarity: 1,
      exact: true,
    };
  }

  const similarity =
    textSimilarity(
      subjectName,
      candidateName,
    );

  return {
    score:
      Math.round(
        similarity * fuzzyMax,
      ),
    similarity,
    exact: false,
  };
}

function baseResult({
  candidateKind,
  candidateId,
  recordId = null,
  snapshotId = null,
  recordType = null,
  relationType = null,
  score,
  hardMatch = false,
  conflict = false,
  reasons = [],
}) {
  return {
    candidateKind,
    candidateId,
    recordId,
    snapshotId,
    recordType,
    relationType,
    score,
    level: candidateLevel(score),
    hardMatch,
    conflict,
    reasons,
  };
}

export function scoreEdrRecordCandidate(
  input,
  record,
) {
  const recordType =
    requireRecordType(
      record?.record_type,
    );

  const subjectName =
    inputName(input);

  const subjectEdrpou =
    normalizeCode(
      input?.edrpou,
    );

  const candidateName =
    normalizeEdrLookupText(
      record?.name,
    );

  const candidateEdrpou =
    normalizeCode(
      record?.edrpou,
    );

  if (
    recordType === "organization" &&
    subjectEdrpou &&
    candidateEdrpou
  ) {
    if (
      subjectEdrpou ===
      candidateEdrpou
    ) {
      return baseResult({
        candidateKind: "record",
        candidateId:
          record.id ?? null,
        recordId:
          record.id ?? null,
        snapshotId:
          record.snapshot_id ?? null,
        recordType,
        score: 100,
        hardMatch: true,
        reasons: [
          "Точний збіг ЄДРПОУ",
        ],
      });
    }

    return baseResult({
      candidateKind: "record",
      candidateId:
        record.id ?? null,
      recordId:
        record.id ?? null,
      snapshotId:
        record.snapshot_id ?? null,
      recordType,
      score: 0,
      conflict: true,
      reasons: [
        "ЄДРПОУ суперечить ЄДРПОУ кандидата",
      ],
    });
  }

  const exactScore =
    recordType === "organization"
      ? 75
      : 70;

  const scoredName =
    nameScore(
      subjectName,
      candidateName,
      { exactScore },
    );

  const reasons = [];

  if (scoredName.exact) {
    reasons.push(
      recordType === "fop"
        ? "Точний збіг ПІБ ФОП"
        : "Точний збіг назви організації",
    );
  } else if (scoredName.score > 0) {
    reasons.push(
      `Схожість назви: ${Math.round(scoredName.similarity * 100)}%`,
    );
  }

  if (
    recordType === "fop" &&
    scoredName.score >= 70
  ) {
    reasons.push(
      "ПІБ без стабільного ідентифікатора не підтверджує особу автоматично",
    );
  }

  return baseResult({
    candidateKind: "record",
    candidateId:
      record.id ?? null,
    recordId:
      record.id ?? null,
    snapshotId:
      record.snapshot_id ?? null,
    recordType,
    score:
      Math.max(
        0,
        Math.min(
          100,
          scoredName.score,
        ),
      ),
    reasons,
  });
}

export function scoreEdrRelationCandidate(
  input,
  relation,
) {
  const relationType =
    requireRelationType(
      relation?.relation_type,
    );

  const subjectName =
    inputName(input);

  const candidateName =
    normalizeEdrLookupText(
      relation?.value_text ??
      relation?.normalized_value ??
      null,
    );

  const scoredName =
    nameScore(
      subjectName,
      candidateName,
      {
        exactScore: 70,
      },
    );

  const reasons = [];

  if (scoredName.exact) {
    reasons.push(
      `Точний збіг ПІБ у зв'язку ${relationType}`,
    );
    reasons.push(
      "ПІБ у зв'язку ЄДР не є стабільним ідентифікатором особи",
    );
  } else if (scoredName.score > 0) {
    reasons.push(
      `Схожість ПІБ у зв'язку: ${Math.round(scoredName.similarity * 100)}%`,
    );
  }

  return baseResult({
    candidateKind: "relation",
    candidateId:
      relation.id ?? null,
    recordId:
      relation.record_id ?? null,
    snapshotId:
      relation.snapshot_id ?? null,
    recordType:
      relation.record_type ?? null,
    relationType,
    score:
      Math.max(
        0,
        Math.min(
          100,
          scoredName.score,
        ),
      ),
    reasons,
  });
}

export function rankEdrSubjectCandidates(
  input,
  {
    records = [],
    relations = [],
  } = {},
) {
  const subjectName =
    inputName(input);

  const subjectEdrpou =
    normalizeCode(
      input?.edrpou,
    );

  if (
    !subjectName &&
    !subjectEdrpou
  ) {
    throw new TypeError(
      "fullName/name or edrpou is required",
    );
  }

  if (!Array.isArray(records)) {
    throw new TypeError(
      "records must be an array",
    );
  }

  if (!Array.isArray(relations)) {
    throw new TypeError(
      "relations must be an array",
    );
  }

  const candidates = [
    ...records.map(
      (record) =>
        scoreEdrRecordCandidate(
          input,
          record,
        ),
    ),
    ...relations.map(
      (relation) =>
        scoreEdrRelationCandidate(
          input,
          relation,
        ),
    ),
  ].sort((left, right) => {
    if (
      left.hardMatch !==
      right.hardMatch
    ) {
      return left.hardMatch
        ? -1
        : 1;
    }

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return String(
      left.candidateId ?? "",
    ).localeCompare(
      String(
        right.candidateId ?? "",
      ),
    );
  });

  const best =
    candidates[0] ?? null;

  if (
    best?.hardMatch &&
    best.level ===
      EDR_SUBJECT_MATCH_LEVELS.CONFIRMED
  ) {
    return {
      status: "matched",
      decision:
        "exact_stable_identifier",
      best,
      candidates,
    };
  }

  if (
    best &&
    best.score >= 55
  ) {
    return {
      status: "ambiguous",
      decision: "manual_review",
      best,
      candidates,
    };
  }

  return {
    status: "unmatched",
    decision: "no_match",
    best,
    candidates,
  };
}
