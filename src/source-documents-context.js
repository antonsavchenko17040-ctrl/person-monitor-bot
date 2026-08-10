import { db } from "./db.js";

function iso(value) {
  if (value == null) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export async function loadReportSourceDocuments(
  subjectId,
  entityId,
  options = {},
) {
  if (!subjectId || !entityId) {
    return [];
  }

  const sql =
    options.sql ??
    (process.env.DATABASE_URL?.trim()
      ? db()
      : null);

  if (!sql) {
    return [];
  }

  const rows =
    await sql`
      WITH relevant_ids AS (
        SELECT DISTINCT
          f.source_document_id AS id

        FROM facts f

        WHERE
          f.entity_id =
            ${entityId}

          AND f.source_document_id
              IS NOT NULL

        UNION

        SELECT DISTINCT
          r.source_document_id AS id

        FROM relations r

        WHERE
          (
            r.from_entity_id =
              ${entityId}

            OR r.to_entity_id =
              ${entityId}
          )

          AND r.source_document_id
              IS NOT NULL

        UNION

        SELECT DISTINCT
          m.source_document_id AS id

        FROM mentions m

        WHERE
          (
            m.subject_id =
              ${subjectId}

            OR m.entity_id =
              ${entityId}
          )

          AND m.source_document_id
              IS NOT NULL
      )

      SELECT
        sd.id,
        sd.source_type,
        sd.source_name,
        sd.external_id,
        sd.url,
        sd.title,
        sd.published_at,
        sd.fetched_at,
        sd.created_at

      FROM source_documents sd

      JOIN relevant_ids r
        ON r.id = sd.id

      ORDER BY
        COALESCE(
          sd.published_at,
          sd.fetched_at,
          sd.created_at
        ) DESC NULLS LAST,

        sd.id
    `;

  return rows.map(
    (row) => ({
      id:
        row.id,

      source_type:
        row.source_type ?? null,

      source_name:
        row.source_name ?? null,

      external_id:
        row.external_id ?? null,

      url:
        row.url ?? null,

      title:
        row.title ?? null,

      published_at:
        iso(
          row.published_at,
        ),

      fetched_at:
        iso(
          row.fetched_at,
        ),

      created_at:
        iso(
          row.created_at,
        ),
    }),
  );
}
