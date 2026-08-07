import { db } from "./db.js";

export const GRAPH_RELATION_LABELS = {
  employed_by: "Місце роботи",
  declared_asset: "Задекларований об’єкт",
  income_from: "Джерело доходу",
  family_member_observed: "Член сім’ї",
  third_party_rightsholder: "Третя сторона / правовласник",
  resolved_to: "Ідентифіковано як",
};

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
      // Ignore invalid JSON.
    }
  }

  return {};
}

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

export function safeEntityMetadata(
  value,
) {
  const metadata =
    asObject(value);

  const result = {};

  const allowed = [
    "asset_kind",
    "object_type",
    "other_object_type",
    "country",
    "region",
    "district",
    "city",
    "area",
    "acquisition_date",
    "brand",
    "model",
    "production_year",
    "edrpou",
    "identification",
    "observation",
    "identity_confidence",
  ];

  for (const key of allowed) {
    if (
      metadata[key] !==
        undefined &&
      metadata[key] !== null
    ) {
      result[key] =
        metadata[key];
    }
  }

  const resolution =
    asObject(
      metadata
        .identity_resolution,
    );

  if (resolution.status) {
    result.resolution_status =
      resolution.status;
  }

  if (
    resolution.score !==
      undefined &&
    resolution.score !== null
  ) {
    result.resolution_score =
      resolution.score;
  }

  return result;
}

export function safeRelationMetadata(
  value,
) {
  const metadata =
    asObject(value);

  const result = {};

  const scalarKeys = [
    "declaration_year",
    "asset_kind",
    "relation",
    "workplace",
    "position",
    "organization_name",
    "organization_edrpou",
    "total_income_uah",
    "evidence_count",
    "relation_semantics",
    "third_party_kind",
  ];

  for (const key of scalarKeys) {
    if (
      metadata[key] !==
        undefined &&
      metadata[key] !== null
    ) {
      result[key] =
        metadata[key];
    }
  }

  const arrayKeys = [
    "income_types",
    "ownership_types",
    "holder_roles",
  ];

  for (const key of arrayKeys) {
    if (
      Array.isArray(
        metadata[key],
      )
    ) {
      result[key] =
        metadata[key];
    }
  }

  if (
    Array.isArray(
      metadata.evidence,
    )
  ) {
    result.rights =
      metadata.evidence.map(
        (item) => ({
          ownership_type:
            clean(
              item
                ?.ownership_type,
            ),

          other_ownership:
            clean(
              item
                ?.other_ownership,
            ),

          share_percent:
            item
              ?.share_percent ??
            null,
        }),
      );
  }

  return result;
}

function nodeFromRow(
  row,
  side,
  depth,
) {
  return {
    id:
      row[
        `${side}_id`
      ],

    entity_type:
      row[
        `${side}_entity_type`
      ],

    label:
      row[
        `${side}_canonical_name`
      ] ||
      "Без назви",

    status:
      row[
        `${side}_status`
      ] ||
      "active",

    depth,

    metadata:
      safeEntityMetadata(
        row[
          `${side}_metadata`
        ],
      ),
  };
}

function relationEdge(
  row,
  rootId,
) {
  const depth =
    String(
      row.from_id,
    ) === String(rootId)
      ? 1
      : 2;

  return {
    id:
      row.relation_id,

    source:
      row.from_id,

    target:
      row.to_id,

    type:
      row.relation_type,

    label:
      GRAPH_RELATION_LABELS[
        row.relation_type
      ] ??
      row.relation_type,

    depth,

    valid_from:
      row.valid_from ??
      null,

    valid_to:
      row.valid_to ??
      null,

    confidence:
      row.confidence ??
      null,

    metadata:
      safeRelationMetadata(
        row.relation_metadata,
      ),
  };
}

export function buildSubjectGraphPayload({
  subject,
  year,
  availableYears = [],
  rows = [],
}) {
  const rootId =
    String(
      subject.entity_id,
    );

  const nodes =
    new Map();

  const edges =
    new Map();

  nodes.set(
    rootId,
    {
      id: rootId,

      entity_type:
        "person",

      label:
        subject.full_name,

      status:
        "active",

      depth: 0,

      metadata: {
        organization:
          subject.organization ??
          null,

        position:
          subject.position ??
          null,

        city:
          subject.city ??
          null,
      },
    },
  );

  for (const row of rows) {
    const edge =
      relationEdge(
        row,
        rootId,
      );

    const fromDepth =
      String(
        row.from_id,
      ) === rootId
        ? 0
        : 1;

    const toDepth =
      edge.depth;

    if (
      !nodes.has(
        String(row.from_id),
      )
    ) {
      nodes.set(
        String(row.from_id),

        nodeFromRow(
          row,
          "from",
          fromDepth,
        ),
      );
    }

    if (
      !nodes.has(
        String(row.to_id),
      )
    ) {
      nodes.set(
        String(row.to_id),

        nodeFromRow(
          row,
          "to",
          toDepth,
        ),
      );
    }

    edges.set(
      String(edge.id),
      edge,
    );
  }

  const nodeList =
    [...nodes.values()];

  const edgeList =
    [...edges.values()];

  const relationCounts = {};

  for (const edge of edgeList) {
    relationCounts[
      edge.type
    ] =
      (
        relationCounts[
          edge.type
        ] ?? 0
      ) + 1;
  }

  const nodeTypeCounts = {};

  for (const node of nodeList) {
    nodeTypeCounts[
      node.entity_type
    ] =
      (
        nodeTypeCounts[
          node.entity_type
        ] ?? 0
      ) + 1;
  }

  return {
    subject: {
      id:
        subject.subject_id,

      entity_id:
        rootId,

      full_name:
        subject.full_name,

      organization:
        subject.organization ??
        null,

      position:
        subject.position ??
        null,

      city:
        subject.city ??
        null,
    },

    year,

    available_years:
      availableYears,

    nodes:
      nodeList,

    edges:
      edgeList,

    summary: {
      nodes:
        nodeList.length,

      edges:
        edgeList.length,

      relations:
        relationCounts,

      node_types:
        nodeTypeCounts,
    },
  };
}

export async function loadSubjectGraph(
  subjectId,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const subjectRows =
    await sql`
      SELECT
        s.id AS subject_id,

        COALESCE(
          s.entity_id,
          s.id
        ) AS entity_id,

        s.full_name,
        s.organization,
        s.position,
        s.city

      FROM subjects s

      WHERE s.id =
        ${subjectId}

      LIMIT 1
    `;

  if (!subjectRows.length) {
    return null;
  }

  const subject =
    subjectRows[0];

  const yearRows =
    await sql`
      SELECT DISTINCT
        EXTRACT(
          YEAR FROM
          r.valid_from
        )::int AS year

      FROM relations r

      WHERE
        r.from_entity_id =
          ${subject.entity_id}

        AND r.valid_from
          IS NOT NULL

      ORDER BY year DESC
    `;

  const availableYears =
    yearRows
      .map(
        (row) =>
          Number(row.year),
      )
      .filter(
        Number.isInteger,
      );

  const requestedYear =
    options.year == null
      ? null
      : Number(
          options.year,
        );

  const selectedYear =
    Number.isInteger(
      requestedYear,
    )
      ? requestedYear
      : (
          availableYears[0] ??
          null
        );

  let rows = [];

  if (
    selectedYear !== null
  ) {
    rows =
      await sql`
        WITH direct AS (
          SELECT r.*

          FROM relations r

          WHERE
            r.from_entity_id =
              ${subject.entity_id}

            AND r.valid_from
              IS NOT NULL

            AND EXTRACT(
              YEAR FROM
              r.valid_from
            )::int =
              ${selectedYear}
        ),

        asset_nodes AS (
          SELECT DISTINCT
            to_entity_id AS id

          FROM direct

          WHERE relation_type =
            'declared_asset'
        ),

        secondary AS (
          SELECT r.*

          FROM relations r

          JOIN asset_nodes a
            ON a.id =
               r.from_entity_id

          WHERE
            r.relation_type =
              'third_party_rightsholder'

            AND r.valid_from
              IS NOT NULL

            AND EXTRACT(
              YEAR FROM
              r.valid_from
            )::int =
              ${selectedYear}
        ),

        graph_edges AS (
          SELECT *
          FROM direct

          UNION ALL

          SELECT *
          FROM secondary
        )

        SELECT
          ge.id
            AS relation_id,

          ge.relation_type,

          ge.valid_from,
          ge.valid_to,

          ge.confidence,

          ge.metadata
            AS relation_metadata,

          ef.id
            AS from_id,

          ef.entity_type
            AS from_entity_type,

          ef.canonical_name
            AS from_canonical_name,

          ef.status
            AS from_status,

          ef.metadata
            AS from_metadata,

          et.id
            AS to_id,

          et.entity_type
            AS to_entity_type,

          et.canonical_name
            AS to_canonical_name,

          et.status
            AS to_status,

          et.metadata
            AS to_metadata

        FROM graph_edges ge

        JOIN entities ef
          ON ef.id =
             ge.from_entity_id

        JOIN entities et
          ON et.id =
             ge.to_entity_id

        ORDER BY
          ge.relation_type,
          et.canonical_name,
          ge.id
      `;
  }

  return buildSubjectGraphPayload({
    subject,
    year:
      selectedYear,

    availableYears,
    rows,
  });
}
