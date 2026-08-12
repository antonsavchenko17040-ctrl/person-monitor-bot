import {
  db,
} from "./db.js";

import {
  CANONICAL_JSON_HASH_VERSION,
  canonicalJson,
  canonicalJsonHash,
} from "./canonical-json.js";


export const DOSSIER_VERSION_STORE_VERSION =
  "dossier-version-store-v1";


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOSSIER_STATUSES =
  new Set([
    "completed",
    "partial",
  ]);


function requiredText(
  value,
  field,
) {
  const text =
    String(
      value ?? "",
    ).trim();

  if (!text) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return text;
}


function requiredUuid(
  value,
  field,
) {
  const text =
    requiredText(
      value,
      field,
    );

  if (!UUID_RE.test(text)) {
    throw new TypeError(
      `${field} must be a UUID`,
    );
  }

  return text.toLowerCase();
}


function requiredPlainObject(
  value,
  field,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      `${field} must be an object`,
    );
  }

  const prototype =
    Object.getPrototypeOf(
      value,
    );

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw new TypeError(
      `${field} must be a plain object`,
    );
  }

  return value;
}


function isoTimestamp(
  value,
  field,
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new TypeError(
      `${field} must be a valid timestamp`,
    );
  }

  return date.toISOString();
}


function nullableIso(
  value,
) {
  if (value == null) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? String(value)
    : date.toISOString();
}


function normalizeRow(
  row,
) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id ?? null,

    subject_id:
      row.subject_id ?? null,

    dossier_status:
      row.dossier_status ?? null,

    orchestrator_version:
      row.orchestrator_version ??
      null,

    report_schema_version:
      row.report_schema_version ??
      null,

    report_generated_at:
      nullableIso(
        row.report_generated_at,
      ),

    report_payload:
      row.report_payload ??
      null,

    report_payload_hash:
      row.report_payload_hash ??
      null,

    report_payload_hash_version:
      row.report_payload_hash_version ??
      null,

    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? row.metadata
        : {},

    created_at:
      nullableIso(
        row.created_at,
      ),
  };
}


export async function loadLatestDossierVersion(
  {
    subjectId,
  } = {},
  options = {},
) {
  const normalizedSubjectId =
    requiredUuid(
      subjectId,
      "subjectId",
    );

  const sql =
    options.sql ??
    db();

  const rows =
    await sql`
      SELECT
        id,
        subject_id,
        dossier_status,
        orchestrator_version,
        report_schema_version,
        report_generated_at,
        report_payload,
        report_payload_hash,
        report_payload_hash_version,
        metadata,
        created_at
      FROM dossier_versions
      WHERE subject_id =
        ${normalizedSubjectId}
      ORDER BY
        created_at DESC,
        id DESC
      LIMIT 1
    `;

  return normalizeRow(
    rows?.[0] ??
    null,
  );
}


export async function loadDossierVersionById(
  {
    dossierVersionId,
  } = {},
  options = {},
) {
  const normalizedVersionId =
    requiredUuid(
      dossierVersionId,
      "dossierVersionId",
    );

  const sql =
    options.sql ??
    db();

  const rows =
    await sql`
      SELECT
        id,
        subject_id,
        dossier_status,
        orchestrator_version,
        report_schema_version,
        report_generated_at,
        report_payload,
        report_payload_hash,
        report_payload_hash_version,
        metadata,
        created_at
      FROM dossier_versions
      WHERE id =
        ${normalizedVersionId}
      LIMIT 1
    `;

  return normalizeRow(
    rows?.[0] ??
    null,
  );
}


export async function saveDossierVersion(
  {
    subjectId,
    dossierStatus,
    orchestratorVersion,
    report,
    metadata = {},
  } = {},
  options = {},
) {
  const normalizedSubjectId =
    requiredUuid(
      subjectId,
      "subjectId",
    );

  const normalizedStatus =
    requiredText(
      dossierStatus,
      "dossierStatus",
    );

  if (
    !DOSSIER_STATUSES.has(
      normalizedStatus,
    )
  ) {
    throw new TypeError(
      "dossierStatus must be completed or partial",
    );
  }

  const normalizedOrchestratorVersion =
    requiredText(
      orchestratorVersion,
      "orchestratorVersion",
    );

  const payload =
    requiredPlainObject(
      report,
      "report",
    );

  const reportSchemaVersion =
    requiredText(
      payload.schema_version,
      "report.schema_version",
    );

  const reportGeneratedAt =
    isoTimestamp(
      payload.generated_at,
      "report.generated_at",
    );

  const reportSubjectId =
    requiredUuid(
      payload?.subject?.subject_id,
      "report.subject.subject_id",
    );

  if (
    reportSubjectId !==
    normalizedSubjectId
  ) {
    throw new TypeError(
      "report subject does not match subjectId",
    );
  }

  const normalizedMetadata =
    requiredPlainObject(
      metadata,
      "metadata",
    );

  const reportJson =
    canonicalJson(
      payload,
    );

  const reportPayloadHash =
    canonicalJsonHash(
      payload,
    );

  const metadataJson =
    canonicalJson(
      normalizedMetadata,
    );

  const sql =
    options.sql ??
    db();

  const rows =
    await sql`
      INSERT INTO dossier_versions (
        subject_id,
        dossier_status,
        orchestrator_version,
        report_schema_version,
        report_generated_at,
        report_payload,
        report_payload_hash,
        report_payload_hash_version,
        metadata
      )
      VALUES (
        ${normalizedSubjectId},
        ${normalizedStatus},
        ${normalizedOrchestratorVersion},
        ${reportSchemaVersion},
        ${reportGeneratedAt},
        ${reportJson}::jsonb,
        ${reportPayloadHash},
        ${CANONICAL_JSON_HASH_VERSION},
        ${metadataJson}::jsonb
      )
      RETURNING
        id,
        subject_id,
        dossier_status,
        orchestrator_version,
        report_schema_version,
        report_generated_at,
        report_payload,
        report_payload_hash,
        report_payload_hash_version,
        metadata,
        created_at
    `;

  const row =
    normalizeRow(
      rows?.[0] ??
      null,
    );

  if (!row) {
    throw new Error(
      "Failed to persist dossier version",
    );
  }

  return row;
}
