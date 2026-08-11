import {
  findActiveEdrRecords,
  findActiveEdrRelations,
} from "./edr-index.js";

import {
  normalizeEdrLookupText,
} from "./edr-import-shape.js";

import {
  rankEdrSubjectCandidates,
} from "./edr-subject-matcher.js";

export const EDR_SUBJECT_PERSON_RELATION_TYPES =
  Object.freeze([
    "founder",
    "beneficiary",
    "signer",
    "member",
    "executive_power",
    "superior_management",
  ]);

const MAX_RESULTS = 100;

function requireSql(sql) {
  if (typeof sql !== "function") {
    throw new TypeError(
      "sql must be a tagged-template function",
    );
  }

  return sql;
}

function lookupLimit(
  value,
  fallback,
  label,
) {
  const number =
    value == null
      ? fallback
      : Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > MAX_RESULTS
  ) {
    throw new RangeError(
      `${label} must be an integer between 1 and ${MAX_RESULTS}`,
    );
  }

  return number;
}

function normalizeCode(value) {
  if (value == null) {
    return null;
  }

  return (
    String(value).trim() ||
    null
  );
}

function uniqueRows(rows) {
  const unique = new Map();

  for (const row of rows ?? []) {
    const key = [
      row?.snapshot_id ?? "",
      row?.id ?? "",
    ].join("|");

    if (
      row &&
      !unique.has(key)
    ) {
      unique.set(key, row);
    }
  }

  return [...unique.values()];
}

export async function findActiveEdrSubjectCandidates(
  sql,
  input,
  options = {},
) {
  requireSql(sql);

  const normalizedName =
    normalizeEdrLookupText(
      input?.fullName ??
      input?.name ??
      null,
    );

  const edrpou =
    normalizeCode(
      input?.edrpou,
    );

  if (
    !normalizedName &&
    !edrpou
  ) {
    throw new TypeError(
      "fullName/name or edrpou is required",
    );
  }

  const recordLimit =
    lookupLimit(
      options.recordLimit,
      50,
      "recordLimit",
    );

  const relationLimit =
    lookupLimit(
      options.relationLimit,
      100,
      "relationLimit",
    );

  const findRecords =
    options.findRecords ??
    findActiveEdrRecords;

  const findRelations =
    options.findRelations ??
    findActiveEdrRelations;

  const records = [];

  if (edrpou) {
    records.push(
      ...await findRecords(
        sql,
        {
          edrpou,
          recordType:
            "organization",
          limit: recordLimit,
        },
      ),
    );
  }

  if (normalizedName) {
    records.push(
      ...await findRecords(
        sql,
        {
          name: normalizedName,
          limit: recordLimit,
        },
      ),
    );
  }

  const uniqueRecords =
    uniqueRows(records);

  const relations =
    normalizedName
      ? uniqueRows(
          await findRelations(
            sql,
            {
              value:
                normalizedName,
              relationTypes:
                EDR_SUBJECT_PERSON_RELATION_TYPES,
              limit:
                relationLimit,
            },
          ),
        )
      : [];

  const ranked =
    rankEdrSubjectCandidates(
      {
        ...input,
        fullName:
          input?.fullName ??
          input?.name ??
          null,
        edrpou,
      },
      {
        records:
          uniqueRecords,
        relations,
      },
    );

  return {
    ...ranked,
    records:
      uniqueRecords,
    relations,
    retrieval: {
      normalized_name:
        normalizedName,
      edrpou,
      record_count:
        uniqueRecords.length,
      relation_count:
        relations.length,
      record_limit:
        recordLimit,
      relation_limit:
        relationLimit,
      relation_types:
        [
          ...EDR_SUBJECT_PERSON_RELATION_TYPES,
        ],
    },
  };
}
