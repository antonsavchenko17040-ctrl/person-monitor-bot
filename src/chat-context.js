import { db } from "./db.js";
import {
  getSubject,
  listMentions,
} from "./store.js";
import {
  buildEntityAnalytics,
} from "./analytics.js";

export async function loadDeterministicEmploymentContext(
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
           'employment'

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
          'employment'
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

export async function loadDeterministicIncomeContext(
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
           'income'

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
          "income"
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

export async function loadDeterministicOrganizationRelationsContext(
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

  const isOrganizationType =
    (value) => {
      const type =
        String(
          value ?? ""
        );

      return (
        type ===
          "organization" ||
        type ===
          "organization_observation"
      );
    };

  const relations =
    rows
      .filter(
        (row) =>
          row?.id &&
          (
            isOrganizationType(
              row.from_entity_type
            ) ||
            isOrganizationType(
              row.to_entity_type
            )
          )
      )
      .map(
        (row) => ({
          id:
            row.id,

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

export async function loadSubjectKnowledge(
  subjectId,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const subject =
    await getSubject(subjectId);

  if (!subject) {
    return null;
  }

  const entityId =
    subject.entity_id ??
    subject.id;

  const [
    mentions,
    facts,
    relations,
    crossChecks,
    sourceDocuments,
    analytics,
  ] = await Promise.all([
    listMentions(
      subjectId,
      10000,
    ),

    sql`
      SELECT
        id,
        entity_id,
        fact_type,
        value_text,
        value_number,
        value_date,
        value_json,
        unit,
        source_document_id,
        valid_from,
        valid_to,
        confidence,
        verification_status,
        metadata,
        created_at
      FROM facts
      WHERE entity_id = ${entityId}
      ORDER BY
        valid_from ASC NULLS LAST,
        created_at ASC
    `,

    sql`
      WITH direct AS (
        SELECT
          r.*,
          'direct'::text
            AS relation_scope

        FROM relations r

        WHERE
          r.from_entity_id = ${entityId}
          OR r.to_entity_id = ${entityId}
      ),

      subject_assets AS (
        SELECT DISTINCT
          to_entity_id AS entity_id

        FROM direct

        WHERE
          from_entity_id = ${entityId}
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

        WHERE
          r.relation_type =
            'third_party_rightsholder'

          AND NOT EXISTS (
            SELECT 1
            FROM direct d
            WHERE d.id = r.id
          )
      ),

      relevant AS (
        SELECT * FROM direct
        UNION ALL
        SELECT * FROM second_hop
      )

      SELECT
        r.id,
        r.from_entity_id,
        r.to_entity_id,
        r.relation_type,
        r.relation_scope,
        r.source_document_id,
        r.valid_from,
        r.valid_to,
        r.confidence,
        r.verification_status,
        r.metadata,
        r.created_at,

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

      FROM relevant r

      JOIN entities ef
        ON ef.id =
           r.from_entity_id

      JOIN entities et
        ON et.id =
           r.to_entity_id

      ORDER BY
        r.valid_from ASC NULLS LAST,
        r.created_at ASC
    `,

    sql`
      SELECT
        id,
        entity_id,
        check_type,
        rule_code,
        left_fact_id,
        right_fact_id,
        left_source_document_id,
        right_source_document_id,
        result,
        score,
        details,
        created_at
      FROM cross_checks
      WHERE entity_id = ${entityId}
      ORDER BY created_at ASC
    `,

    sql`
      WITH direct_relations AS (
        SELECT r.*
        FROM relations r
        WHERE
          r.from_entity_id = ${entityId}
          OR r.to_entity_id = ${entityId}
      ),

      subject_assets AS (
        SELECT DISTINCT
          to_entity_id AS entity_id
        FROM direct_relations
        WHERE
          from_entity_id = ${entityId}
          AND relation_type =
            'declared_asset'
      ),

      second_hop_relations AS (
        SELECT r.*
        FROM relations r
        JOIN subject_assets a
          ON a.entity_id =
             r.from_entity_id
        WHERE
          r.relation_type =
            'third_party_rightsholder'
      ),

      relevant_relation_documents AS (
        SELECT source_document_id
        FROM direct_relations
        WHERE source_document_id
          IS NOT NULL

        UNION

        SELECT source_document_id
        FROM second_hop_relations
        WHERE source_document_id
          IS NOT NULL
      ),

      relevant_documents AS (
        SELECT source_document_id AS id
        FROM facts
        WHERE
          entity_id = ${entityId}
          AND source_document_id
            IS NOT NULL

        UNION

        SELECT source_document_id
        FROM relevant_relation_documents

        UNION

        SELECT source_document_id
        FROM mentions
        WHERE
          subject_id = ${subjectId}
          AND source_document_id
            IS NOT NULL

        UNION

        SELECT left_source_document_id
        FROM cross_checks
        WHERE
          entity_id = ${entityId}
          AND left_source_document_id
            IS NOT NULL

        UNION

        SELECT right_source_document_id
        FROM cross_checks
        WHERE
          entity_id = ${entityId}
          AND right_source_document_id
            IS NOT NULL
      )

      SELECT DISTINCT
        sd.id,
        sd.source_type,
        sd.source_name,
        sd.external_id,
        sd.url,
        sd.title,
        sd.published_at,
        sd.fetched_at,
        sd.content_hash,
        sd.raw_payload,
        sd.metadata,
        sd.created_at

      FROM source_documents sd

      JOIN relevant_documents rd
        ON rd.id = sd.id

      ORDER BY
        sd.published_at ASC NULLS LAST,
        sd.created_at ASC
    `,

    buildEntityAnalytics(
      entityId,
      { sql },
    ).catch(() => null),
  ]);

  return {
    context_version:
      "subject-knowledge-v1",

    subject,

    mentions,

    facts,

    relations,

    cross_checks:
      crossChecks,

    source_documents:
      sourceDocuments,

    analytics,

    counts: {
      mentions:
        mentions.length,

      facts:
        facts.length,

      relations:
        relations.length,

      cross_checks:
        crossChecks.length,

      source_documents:
        sourceDocuments.length,
    },
  };
}
