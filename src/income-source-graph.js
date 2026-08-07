import { db } from "./db.js";

import {
  normalizeText,
  stableFingerprint,
} from "./utils.js";

import {
  deterministicUuid,
  normalizeEdrpou,
  persistRelationsGraph,
} from "./graph-builder.js";

import {
  observeAndResolvePerson,
} from "./identity-observations.js";

const VERSION =
  "income-source-graph-v1";

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function number(value) {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ];
}

function organizationNode(
  details,
  sourceDocumentId,
) {
  const edrpou =
    normalizeEdrpou(
      details?.edrpou,
    );

  if (!edrpou) {
    return null;
  }

  const name =
    clean(
      details?.company_name,
    ) ||
    `Організація ${edrpou}`;

  const nodeKey =
    `organization:edrpou:${edrpou}`;

  return {
    nodeKey,

    id:
      deterministicUuid(
        nodeKey,
      ),

    entityType:
      "organization",

    canonicalName:
      name,

    identifier: {
      type: "edrpou",
      value: edrpou,
      normalized: edrpou,
      confidence: 100,
    },

    sourceDocumentId,

    metadata: {
      graph_version:
        VERSION,

      identification:
        "edrpou",

      edrpou,
    },
  };
}

export function buildIncomeSourcePlan(
  rows,
) {
  const nodes =
    new Map();

  const relations =
    new Map();

  const observations =
    new Map();

  const stats = {
    rows: rows.length,

    organizationRows: 0,
    personRows: 0,

    organizations: 0,
    incomeFromRelations: 0,

    personObservations: 0,

    deferredOrganizationRows: 0,
    unknownRows: 0,
  };

  for (const row of rows) {
    const details =
      row.value_json
        ?.source_details;

    if (!details) {
      stats.unknownRows += 1;
      continue;
    }

    if (
      details.source_type ===
      "organization"
    ) {
      stats.organizationRows += 1;

      const node =
        organizationNode(
          details,
          row.source_document_id,
        );

      /*
       * Foreign company or company
       * without stable EDRPOU:
       * keep as fact for now.
       */
      if (!node) {
        stats
          .deferredOrganizationRows +=
          1;

        continue;
      }

      nodes.set(
        node.nodeKey,
        node,
      );

      const relationKey =
        stableFingerprint(
          VERSION,
          "income_from",

          row.subject_id,
          node.id,

          row.declaration_year,

          row.source_document_id,
        );

      const existing =
        relations.get(
          relationKey,
        );

      const amount =
        String(
          row.unit ?? "UAH",
        ).toUpperCase() ===
          "UAH"
          ? number(
              row.value_number,
            )
          : 0;

      const incomeType =
        clean(
          row.value_json
            ?.income_type,
        ) ||
        clean(
          row.value_json
            ?.other_income_type,
        ) ||
        clean(
          row.value_text,
        );

      if (existing) {
        existing.metadata
          .fact_ids =
          unique([
            ...existing
              .metadata
              .fact_ids,

            row.id,
          ]);

        existing.metadata
          .income_types =
          unique([
            ...existing
              .metadata
              .income_types,

            incomeType,
          ]);

        existing.metadata
          .total_income_uah +=
          amount;

        existing.metadata
          .evidence_count =
          existing
            .metadata
            .fact_ids
            .length;

        continue;
      }

      relations.set(
        relationKey,
        {
          id:
            deterministicUuid(
              "relation",
              relationKey,
            ),

          relationKey,

          fromEntityId:
            row.subject_id,

          toEntityId:
            node.id,

          relationType:
            "income_from",

          sourceDocumentId:
            row.source_document_id,

          validFrom:
            `${row.declaration_year}-01-01`,

          validTo:
            `${row.declaration_year}-12-31`,

          confidence: 100,

          metadata: {
            graph_version:
              VERSION,

            declaration_year:
              row.declaration_year,

            organization_edrpou:
              node.identifier.value,

            organization_name:
              node.canonicalName,

            fact_ids: [
              row.id,
            ],

            income_types:
              unique([
                incomeType,
              ]),

            total_income_uah:
              amount,

            evidence_count: 1,

            relation_semantics:
              "Організацію вказано як джерело доходу в декларації.",
          },
        },
      );

      continue;
    }

    if (
      details.source_type ===
      "person"
    ) {
      stats.personRows += 1;

      const fullName =
        clean(
          details.person_name,
        );

      if (!fullName) {
        stats.unknownRows += 1;
        continue;
      }

      const observationKey =
        [
          row.source_document_id,
          normalizeText(
            fullName,
          ),
        ].join("|");

      const existing =
        observations.get(
          observationKey,
        );

      if (existing) {
        existing.factIds =
          unique([
            ...existing.factIds,
            row.id,
          ]);

        existing.incomeTypes =
          unique([
            ...existing
              .incomeTypes,

            row.value_text,
          ]);

        existing.totalIncomeUah +=
          String(
            row.unit ?? "UAH",
          ).toUpperCase() ===
            "UAH"
            ? number(
                row.value_number,
              )
            : 0;

        continue;
      }

      observations.set(
        observationKey,
        {
          sourceDocumentId:
            row.source_document_id,

          fullName,

          factIds: [
            row.id,
          ],

          incomeTypes:
            unique([
              row.value_text,
            ]),

          totalIncomeUah:
            String(
              row.unit ?? "UAH",
            ).toUpperCase() ===
              "UAH"
              ? number(
                  row.value_number,
                )
              : 0,
        },
      );

      continue;
    }

    stats.unknownRows += 1;
  }

  const nodeList =
    [...nodes.values()];

  const relationList =
    [...relations.values()];

  const observationList =
    [...observations.values()];

  stats.organizations =
    nodeList.length;

  stats.incomeFromRelations =
    relationList.length;

  stats.personObservations =
    observationList.length;

  return {
    version: VERSION,

    nodes:
      nodeList,

    relations:
      relationList,

    observations:
      observationList,

    stats,
  };
}

async function loadLatestIncomeRows(
  sql,
) {
  return sql`
    WITH ranked AS (
      SELECT
        f.entity_id,

        (
          f.value_json
          ->> 'declaration_year'
        )::int
          AS declaration_year,

        f.source_document_id,

        (
          f.value_json
          ->> 'published_at'
        )::timestamptz
          AS published_at,

        row_number() OVER (
          PARTITION BY
            f.entity_id,

            (
              f.value_json
              ->> 'declaration_year'
            )::int

          ORDER BY
            (
              f.value_json
              ->> 'published_at'
            )::timestamptz
              DESC NULLS LAST,

            f.created_at DESC
        ) AS rn

      FROM facts f

      WHERE
        f.fact_type =
          'declaration_submission'
    ),

    latest AS (
      SELECT
        entity_id,
        declaration_year,
        source_document_id

      FROM ranked

      WHERE rn = 1
    )

    SELECT
      l.entity_id
        AS subject_id,

      l.declaration_year,

      l.source_document_id,

      f.id,
      f.value_text,
      f.value_number,
      f.value_json,
      f.unit

    FROM latest l

    JOIN facts f
      ON f.entity_id =
         l.entity_id

     AND f.source_document_id =
         l.source_document_id

     AND f.fact_type =
         'income'

    ORDER BY
      l.entity_id,
      l.declaration_year,
      f.id
  `;
}

export async function buildIncomeSourceGraphPlan(
  options = {},
) {
  const sql =
    options.sql ?? db();

  const rows =
    options.rows ??
    await loadLatestIncomeRows(
      sql,
    );

  return buildIncomeSourcePlan(
    rows,
  );
}

export async function persistIncomeSourceGraph(
  plan,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const graphStats =
    await persistRelationsGraph(
      {
        nodes:
          plan.nodes,

        relations:
          plan.relations,
      },
      { sql },
    );

  const observations = {
    processed: 0,

    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    conflict: 0,
  };

  for (
    const observation
    of plan.observations
  ) {
    const result =
      await observeAndResolvePerson(
        {
          sourceDocumentId:
            observation
              .sourceDocumentId,

          fullName:
            observation
              .fullName,
        },
        { sql },
      );

    observations.processed += 1;

    if (
      Object.hasOwn(
        observations,
        result.status,
      )
    ) {
      observations[
        result.status
      ] += 1;
    }

    await sql`
      UPDATE identity_observations

      SET details =
        COALESCE(
          details,
          '{}'::jsonb
        )
        ||
        ${JSON.stringify({
          income_source: {
            fact_ids:
              observation.factIds,

            income_types:
              observation
                .incomeTypes,

            total_income_uah:
              observation
                .totalIncomeUah,
          },
        })}::jsonb

      WHERE id =
        ${result.observationId}
    `;
  }

  return {
    ...graphStats,

    observations,
  };
}
