import { db } from "./db.js";

import {
  EDR_GRAPH_RELATION_TYPES,
} from "./edr-relation-graph.js";


export const TIMELESS_EDR_RELATION_TYPES =
  Object.freeze(
    Object.values(
      EDR_GRAPH_RELATION_TYPES,
    ),
  );


function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}


function asObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed =
        JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}


function safeRelationMetadata(value) {
  const source =
    asObject(value);

  const allowed = [
    "source",
    "edr_relation_type",
    "identity_status",
    "identity_decision",
    "review_required",
    "evidence_count",
    "relation_semantics",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) =>
          source[key] !== null &&
          source[key] !== undefined,
      )
      .map(
        (key) => [
          key,
          source[key],
        ],
      ),
  );
}


function safeEntityMetadata(value) {
  const source =
    asObject(value);

  const allowed = [
    "edrpou",
    "identification",
    "identity_confidence",
    "source",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) =>
          source[key] !== null &&
          source[key] !== undefined,
      )
      .map(
        (key) => [
          key,
          source[key],
        ],
      ),
  );
}


function reportConfidence(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


export async function loadTimelessEdrRelations(
  subjectEntityId,
  options = {},
) {
  const normalizedSubjectId =
    clean(subjectEntityId);

  if (!normalizedSubjectId) {
    return [];
  }

  const sql =
    options.sql ?? db();

  const rows =
    await sql`
      SELECT
        r.id
          AS relation_id,

        r.relation_type,

        r.source_document_id,

        r.valid_from,
        r.valid_to,

        r.confidence,
        r.verification_status,

        r.metadata
          AS relation_metadata,

        ef.id
          AS from_entity_id,

        ef.entity_type
          AS from_entity_type,

        ef.canonical_name
          AS from_name,

        ef.metadata
          AS from_metadata,

        et.id
          AS to_entity_id,

        et.entity_type
          AS to_entity_type,

        et.canonical_name
          AS to_name,

        et.metadata
          AS to_metadata

      FROM relations r

      JOIN entities ef
        ON ef.id =
           r.from_entity_id

      JOIN entities et
        ON et.id =
           r.to_entity_id

      WHERE
        r.from_entity_id =
          ${normalizedSubjectId}

        AND r.relation_type =
          ANY(
            ${TIMELESS_EDR_RELATION_TYPES}::text[]
          )

        AND r.valid_from
          IS NULL

        AND r.valid_to
          IS NULL

        AND r.source_document_id
          IS NULL

        AND r.metadata
          ->> ${"source"} =
            ${"edr"}

        AND et.entity_type =
          ${"organization"}

      ORDER BY
        r.relation_type,
        et.canonical_name,
        r.id
    `;

  const allowedTypes =
    new Set(
      TIMELESS_EDR_RELATION_TYPES,
    );

  return (
    Array.isArray(rows)
      ? rows
      : []
  )
    .filter(
      (row) => {
        const metadata =
          asObject(
            row?.relation_metadata,
          );

        const relationId =
          clean(
            row?.relation_id,
          );

        const fromEntityId =
          clean(
            row?.from_entity_id,
          );

        const toEntityId =
          clean(
            row?.to_entity_id,
          );

        return (
          relationId &&
          fromEntityId &&
          toEntityId &&
          fromEntityId ===
            normalizedSubjectId &&
          clean(
            row.to_entity_type,
          ) ===
            "organization" &&
          allowedTypes.has(
            row?.relation_type,
          ) &&
          row?.source_document_id ==
            null &&
          row?.valid_from == null &&
          row?.valid_to == null &&
          metadata.source === "edr"
        );
      },
    )
    .map(
      (row) => ({
        relation_id:
          clean(
            row.relation_id,
          ),

        relation_type:
          clean(
            row.relation_type,
          ),

        relation_scope:
          "timeless",

        source_document_id:
          null,

        valid_from:
          null,

        valid_to:
          null,

        confidence:
          reportConfidence(
            row.confidence,
          ),

        verification_status:
          clean(
            row.verification_status,
          ),

        metadata:
          safeRelationMetadata(
            row.relation_metadata,
          ),

        from_entity_id:
          clean(
            row.from_entity_id,
          ),

        from_entity_type:
          clean(
            row.from_entity_type,
          ),

        from_name:
          clean(
            row.from_name,
          ),

        from_metadata:
          safeEntityMetadata(
            row.from_metadata,
          ),

        to_entity_id:
          clean(
            row.to_entity_id,
          ),

        to_entity_type:
          clean(
            row.to_entity_type,
          ),

        to_name:
          clean(
            row.to_name,
          ),

        to_metadata:
          safeEntityMetadata(
            row.to_metadata,
          ),
      }),
    );
}
