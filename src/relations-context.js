import { db } from "./db.js";

export async function loadDeterministicRelationsContext(
  entityId,
  year,
  options = {},
) {
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

  const sql =
    options.sql ?? db();

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
      ),

      direct AS (
        SELECT
          r.*,

          'direct'::text
            AS relation_scope

        FROM relations r

        CROSS JOIN canonical c

        WHERE
          (
            r.from_entity_id =
              ${entityId}

            OR r.to_entity_id =
              ${entityId}
          )

          AND r.source_document_id =
              c.source_document_id
      ),

      subject_assets AS (
        SELECT DISTINCT
          to_entity_id
            AS entity_id

        FROM direct

        WHERE
          from_entity_id =
            ${entityId}

          AND relation_type =
            'declared_asset'
      ),

      second_hop AS (
        SELECT
          r.*,

          'second_hop'::text
            AS relation_scope

        FROM relations r

        JOIN subject_assets a
          ON a.entity_id =
             r.from_entity_id

        CROSS JOIN canonical c

        WHERE
          r.relation_type =
            'third_party_rightsholder'

          AND r.source_document_id =
              c.source_document_id

          AND NOT EXISTS (
            SELECT 1

            FROM direct d

            WHERE d.id =
              r.id
          )
      ),

      relevant AS (
        SELECT *
        FROM direct

        UNION ALL

        SELECT *
        FROM second_hop
      )

      SELECT
        c.source_document_id
          AS canonical_source_document_id,

        sd.url
          AS source_url,

        r.id,
        r.from_entity_id,
        r.to_entity_id,
        r.relation_type,
        r.relation_scope,
        r.source_document_id,
        r.valid_from,
        r.valid_to,
        r.metadata,

        ef.entity_type
          AS from_entity_type,

        ef.canonical_name
          AS from_name,

        ef.metadata
          AS from_metadata,

        et.entity_type
          AS to_entity_type,

        et.canonical_name
          AS to_name,

        et.metadata
          AS to_metadata

      FROM canonical c

      LEFT JOIN source_documents sd
        ON sd.id =
           c.source_document_id

      LEFT JOIN relevant r
        ON TRUE

      LEFT JOIN entities ef
        ON ef.id =
           r.from_entity_id

      LEFT JOIN entities et
        ON et.id =
           r.to_entity_id

      ORDER BY
        r.relation_type,
        r.relation_scope,
        r.id
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

  const relations =
    rows
      .filter(
        (row) =>
          row?.id &&
          row?.from_entity_id &&
          row?.to_entity_id
      )
      .map(
        (row) => ({
          id:
            row.id,

          from_entity_id:
            row.from_entity_id,

          to_entity_id:
            row.to_entity_id,

          relation_type:
            row.relation_type,

          relation_scope:
            row.relation_scope,

          source_document_id:
            row.source_document_id,

          valid_from:
            row.valid_from,

          valid_to:
            row.valid_to,

          metadata:
            row.metadata,

          from_entity_type:
            row.from_entity_type,

          from_name:
            row.from_name,

          from_metadata:
            row.from_metadata,

          to_entity_type:
            row.to_entity_type,

          to_name:
            row.to_name,

          to_metadata:
            row.to_metadata,
        })
      );

  return {
    detected_years: [
      normalizedYear,
    ],

    relations,

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
