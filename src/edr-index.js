import {
  normalizeEdrLookupText,
} from "./edr-import-shape.js";

export const EDR_INDEX_MAX_RESULTS = 100;

export const EDR_INDEX_RELATION_TYPES =
  Object.freeze([
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

const RECORD_TYPES =
  new Set([
    "organization",
    "fop",
  ]);

const RELATION_TYPES =
  new Set(
    EDR_INDEX_RELATION_TYPES,
  );

function requireSql(sql) {
  if (typeof sql !== "function") {
    throw new TypeError(
      "sql must be a tagged-template function",
    );
  }

  return sql;
}

function optionalRecordType(value) {
  if (
    value == null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const type =
    String(value)
      .trim()
      .toLowerCase();

  if (!RECORD_TYPES.has(type)) {
    throw new TypeError(
      "Unsupported EDR record type",
    );
  }

  return type;
}

function resultLimit(value) {
  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > EDR_INDEX_MAX_RESULTS
  ) {
    throw new RangeError(
      `limit must be an integer between 1 and ${EDR_INDEX_MAX_RESULTS}`,
    );
  }

  return number;
}

function optionalCode(value) {
  if (value == null) {
    return null;
  }

  return (
    String(value).trim() ||
    null
  );
}

function relationTypesValue(value) {
  const source =
    value == null
      ? EDR_INDEX_RELATION_TYPES
      : value;

  if (!Array.isArray(source)) {
    throw new TypeError(
      "relationTypes must be an array",
    );
  }

  const types = [
    ...new Set(
      source
        .map((item) =>
          String(item ?? "").trim(),
        )
        .filter(Boolean),
    ),
  ];

  if (types.length === 0) {
    throw new TypeError(
      "relationTypes must not be empty",
    );
  }

  for (const type of types) {
    if (!RELATION_TYPES.has(type)) {
      throw new TypeError(
        `Unsupported EDR relation type: ${type}`,
      );
    }
  }

  return types;
}

async function queryRecordsByName(
  sql,
  {
    normalizedName,
    normalizedRecordType,
    normalizedLimit,
  },
) {
  return sql`
    SELECT
      r.id,
      r.snapshot_id,
      r.record_type,
      r.record_number,
      r.source_sequence,
      r.name,
      r.normalized_name,
      r.short_name,
      r.edrpou,
      r.status,
      r.legal_form,
      r.registration,
      r.content_hash,
      r.details
    FROM edr_active_snapshot a
    JOIN edr_records r
      ON r.snapshot_id =
        a.snapshot_id
    WHERE a.singleton = true
      AND r.normalized_name =
        ${normalizedName}
      AND (
        ${normalizedRecordType}::text
          IS NULL
        OR r.record_type =
          ${normalizedRecordType}
      )
    ORDER BY
      r.record_type,
      r.source_sequence,
      r.id
    LIMIT ${normalizedLimit}
  `;
}

async function queryRecordsByEdrpou(
  sql,
  {
    normalizedEdrpou,
    normalizedRecordType,
    normalizedLimit,
  },
) {
  return sql`
    SELECT
      r.id,
      r.snapshot_id,
      r.record_type,
      r.record_number,
      r.source_sequence,
      r.name,
      r.normalized_name,
      r.short_name,
      r.edrpou,
      r.status,
      r.legal_form,
      r.registration,
      r.content_hash,
      r.details
    FROM edr_active_snapshot a
    JOIN edr_records r
      ON r.snapshot_id =
        a.snapshot_id
    WHERE a.singleton = true
      AND r.edrpou =
        ${normalizedEdrpou}
      AND (
        ${normalizedRecordType}::text
          IS NULL
        OR r.record_type =
          ${normalizedRecordType}
      )
    ORDER BY
      r.record_type,
      r.source_sequence,
      r.id
    LIMIT ${normalizedLimit}
  `;
}

async function queryRecordsByNameAndEdrpou(
  sql,
  {
    normalizedName,
    normalizedEdrpou,
    normalizedRecordType,
    normalizedLimit,
  },
) {
  return sql`
    SELECT
      r.id,
      r.snapshot_id,
      r.record_type,
      r.record_number,
      r.source_sequence,
      r.name,
      r.normalized_name,
      r.short_name,
      r.edrpou,
      r.status,
      r.legal_form,
      r.registration,
      r.content_hash,
      r.details
    FROM edr_active_snapshot a
    JOIN edr_records r
      ON r.snapshot_id =
        a.snapshot_id
    WHERE a.singleton = true
      AND r.normalized_name =
        ${normalizedName}
      AND r.edrpou =
        ${normalizedEdrpou}
      AND (
        ${normalizedRecordType}::text
          IS NULL
        OR r.record_type =
          ${normalizedRecordType}
      )
    ORDER BY
      r.record_type,
      r.source_sequence,
      r.id
    LIMIT ${normalizedLimit}
  `;
}

export async function findActiveEdrRecords(
  sql,
  {
    name = null,
    edrpou = null,
    recordType = null,
    limit = 20,
  } = {},
) {
  requireSql(sql);

  const normalizedName =
    normalizeEdrLookupText(name);

  const normalizedEdrpou =
    optionalCode(edrpou);

  const normalizedRecordType =
    optionalRecordType(recordType);

  const normalizedLimit =
    resultLimit(limit);

  if (
    !normalizedName &&
    !normalizedEdrpou
  ) {
    throw new TypeError(
      "name or edrpou is required",
    );
  }

  const options = {
    normalizedName,
    normalizedEdrpou,
    normalizedRecordType,
    normalizedLimit,
  };

  if (
    normalizedName &&
    normalizedEdrpou
  ) {
    return queryRecordsByNameAndEdrpou(
      sql,
      options,
    );
  }

  if (normalizedName) {
    return queryRecordsByName(
      sql,
      options,
    );
  }

  return queryRecordsByEdrpou(
    sql,
    options,
  );
}

export async function findActiveEdrRelations(
  sql,
  {
    value,
    relationTypes = null,
    limit = 50,
  } = {},
) {
  requireSql(sql);

  const normalizedValue =
    normalizeEdrLookupText(value);

  if (!normalizedValue) {
    throw new TypeError(
      "value is required",
    );
  }

  const normalizedRelationTypes =
    relationTypesValue(
      relationTypes,
    );

  const normalizedLimit =
    resultLimit(limit);

  return sql`
    SELECT
      observation.id,
      observation.snapshot_id,
      observation.record_id,
      observation.relation_type,
      observation.ordinal,
      observation.value_text,
      observation.normalized_value,
      observation.value_code,
      observation.metadata,
      record.record_type,
      record.record_number,
      record.source_sequence,
      record.name AS record_name,
      record.normalized_name
        AS record_normalized_name,
      record.edrpou AS record_edrpou,
      record.status AS record_status
    FROM edr_active_snapshot active
    JOIN edr_relation_observations
      observation
      ON observation.snapshot_id =
        active.snapshot_id
    JOIN edr_records record
      ON record.id =
        observation.record_id
      AND record.snapshot_id =
        observation.snapshot_id
    WHERE active.singleton = true
      AND observation.relation_type =
        ANY(
          ${normalizedRelationTypes}::text[]
        )
      AND observation.normalized_value =
        ${normalizedValue}
    ORDER BY
      observation.relation_type,
      record.source_sequence,
      observation.ordinal,
      observation.id
    LIMIT ${normalizedLimit}
  `;
}
