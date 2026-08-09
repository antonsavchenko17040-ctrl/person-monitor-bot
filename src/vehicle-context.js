import { db } from "./db.js";

export async function loadDeterministicVehicleContext(
  entityId,
  year,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const normalizedYear =
    Number(year);

  if (
    !entityId ||
    !Number.isInteger(
      normalizedYear
    )
  ) {
    return null;
  }

  const rows =
    await sql`
      WITH canonical AS (
        SELECT
          f.source_document_id

        FROM facts f

        WHERE
          f.entity_id =
            ${entityId}

          AND f.fact_type =
            'declaration_submission'

          AND (
            f.value_json
            ->> 'declaration_year'
          )::int =
            ${normalizedYear}

        ORDER BY
          (
            f.value_json
            ->> 'published_at'
          )::timestamptz
            DESC NULLS LAST,

          f.created_at DESC

        LIMIT 1
      )

      SELECT
        c.source_document_id
          AS canonical_source_document_id,

        sd.url
          AS source_url,

        f.id,
        f.entity_id,
        f.fact_type,
        f.value_text,
        f.value_number,
        f.value_date,
        f.value_json,
        f.unit,
        f.source_document_id,
        f.valid_from,
        f.valid_to,
        f.confidence,
        f.verification_status,
        f.metadata,
        f.created_at

      FROM canonical c

      LEFT JOIN source_documents sd
        ON sd.id =
           c.source_document_id

      LEFT JOIN facts f
        ON f.entity_id =
           ${entityId}

       AND f.source_document_id =
           c.source_document_id

       AND f.fact_type =
           'vehicle'

      ORDER BY
        f.created_at ASC
    `;

  if (!rows.length) {
    return null;
  }

  const canonicalSourceId =
    rows[0]
      ?.canonical_source_document_id ??
    null;

  if (!canonicalSourceId) {
    return null;
  }

  const sourceUrl =
    rows[0]
      ?.source_url ??
    null;

  const facts =
    rows
      .filter(
        (row) =>
          row?.fact_type ===
          "vehicle"
      )
      .map(
        (row) => ({
          id:
            row.id,

          entity_id:
            row.entity_id,

          fact_type:
            row.fact_type,

          value_text:
            row.value_text,

          value_number:
            row.value_number,

          value_date:
            row.value_date,

          value_json:
            row.value_json,

          unit:
            row.unit,

          source_document_id:
            row.source_document_id,

          valid_from:
            row.valid_from,

          valid_to:
            row.valid_to,

          confidence:
            row.confidence,

          verification_status:
            row.verification_status,

          metadata: {
            ...(
              row.metadata ??
              {}
            ),

            declaration_year:
              normalizedYear,
          },

          created_at:
            row.created_at,
        })
      );

  return {
    detected_years: [
      normalizedYear,
    ],

    analytics: {
      yearly: [
        {
          year:
            normalizedYear,

          sourceDocumentId:
            canonicalSourceId,
        },
      ],
    },

    facts,

    source_documents:
      sourceUrl
        ? [
            {
              id:
                canonicalSourceId,

              url:
                sourceUrl,
            },
          ]
        : [],
  };
}
