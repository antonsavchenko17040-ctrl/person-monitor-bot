import { db } from "./db.js";

import {
  normalizeText,
  stableFingerprint,
} from "./utils.js";

import {
  assetIdentity,
  deterministicUuid,
  normalizeEdrpou,
  persistRelationsGraph,
} from "./graph-builder.js";

import {
  observeAndResolvePerson,
} from "./identity-observations.js";

const VERSION =
  "family-third-party-v1";

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ];
}

function dateForYear(
  year,
  end = false,
) {
  return end
    ? `${year}-12-31`
    : `${year}-01-01`;
}

function observationNode({
  entityType,
  name,
  sourceDocumentId,
}) {
  const normalizedName =
    normalizeText(name);

  if (!normalizedName) {
    return null;
  }

  const nodeKey = [
    entityType,
    sourceDocumentId,
    normalizedName,
  ].join(":");

  const observationKey =
    stableFingerprint(
      VERSION,
      nodeKey,
    );

  return {
    nodeKey,

    id:
      deterministicUuid(
        nodeKey,
      ),

    entityType,

    canonicalName:
      name,

    identifier: {
      type:
        entityType ===
        "person_observation"
          ? "person_observation_key"
          : "organization_observation_key",

      value:
        observationKey,

      normalized:
        observationKey,

      confidence: 50,
    },

    sourceDocumentId,

    metadata: {
      graph_version:
        VERSION,

      observation: true,

      normalized_name:
        normalizedName,

      source_document_id:
        sourceDocumentId,
    },
  };
}

function stableOrganizationNode({
  name,
  edrpou,
  sourceDocumentId,
}) {
  const normalizedEdrpou =
    normalizeEdrpou(edrpou);

  if (!normalizedEdrpou) {
    return null;
  }

  const nodeKey =
    `organization:edrpou:${normalizedEdrpou}`;

  return {
    nodeKey,

    id:
      deterministicUuid(
        nodeKey,
      ),

    entityType:
      "organization",

    canonicalName:
      clean(name) ||
      `Організація ${normalizedEdrpou}`,

    identifier: {
      type: "edrpou",

      value:
        normalizedEdrpou,

      normalized:
        normalizedEdrpou,

      confidence: 100,
    },

    sourceDocumentId,

    metadata: {
      graph_version:
        VERSION,

      identification:
        "edrpou",

      edrpou:
        normalizedEdrpou,
    },
  };
}

function assetNodeId(row) {
  const identity =
    assetIdentity(row);

  if (!identity) {
    return null;
  }

  return deterministicUuid(
    `asset:${identity.fingerprint}`,
  );
}

export function buildFamilyThirdPartyPlan(
  rows,
) {
  const nodes =
    new Map();

  const relations =
    new Map();

  const people =
    new Map();

  const stats = {
    rows:
      rows.length,

    familyRows: 0,
    familyRelations: 0,

    thirdPartyRights: 0,
    thirdPartyRelations: 0,

    personObservationNodes: 0,
    organizationObservationNodes: 0,
    stableOrganizationNodes: 0,

    skippedAssets: 0,
    deferredThirdParties: 0,
  };

  function registerPerson(
    node,
    row,
    context,
  ) {
    const existing =
      people.get(node.id);

    if (existing) {
      existing.contexts.push(
        context,
      );

      return;
    }

    people.set(
      node.id,
      {
        nodeId:
          node.id,

        sourceDocumentId:
          row.source_document_id,

        declarationYear:
          row.declaration_year,

        fullName:
          node.canonicalName,

        contexts: [
          context,
        ],
      },
    );
  }

  for (const row of rows) {
    if (
      row.fact_type ===
      "family_member"
    ) {
      stats.familyRows += 1;

      const name =
        clean(
          row.value_json?.name,
        );

      if (!name) {
        continue;
      }

      const node =
        observationNode({
          entityType:
            "person_observation",

          name,

          sourceDocumentId:
            row.source_document_id,
        });

      if (!node) {
        continue;
      }

      nodes.set(
        node.nodeKey,
        node,
      );

      registerPerson(
        node,
        row,
        {
          context:
            "family_member",

          fact_id:
            row.id,

          relation:
            clean(
              row.value_json
                ?.relation,
            ),

          person_ref:
            clean(
              row.value_json
                ?.person_ref,
            ),
        },
      );

      const relationKey =
        stableFingerprint(
          VERSION,
          "family_member_observed",

          row.subject_id,
          node.id,

          row.declaration_year,
          row.source_document_id,
        );

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
            "family_member_observed",

          sourceDocumentId:
            row.source_document_id,

          validFrom:
            dateForYear(
              row.declaration_year,
            ),

          validTo:
            dateForYear(
              row.declaration_year,
              true,
            ),

          confidence: 100,

          metadata: {
            graph_version:
              VERSION,

            declaration_year:
              row.declaration_year,

            relation:
              clean(
                row.value_json
                  ?.relation,
              ),

            person_ref:
              clean(
                row.value_json
                  ?.person_ref,
              ),

            fact_ids: [
              row.id,
            ],

            relation_semantics:
              "Особа вказана членом сім'ї у конкретній декларації; identity ще може потребувати окремого підтвердження.",
          },
        },
      );

      continue;
    }

    if (
      row.fact_type !==
        "real_estate" &&
      row.fact_type !==
        "vehicle"
    ) {
      continue;
    }

    const assetId =
      assetNodeId(row);

    if (!assetId) {
      stats.skippedAssets += 1;
      continue;
    }

    const rights =
      Array.isArray(
        row.value_json?.rights,
      )
        ? row.value_json.rights
        : [];

    for (
      let rightIndex = 0;
      rightIndex <
      rights.length;
      rightIndex += 1
    ) {
      const right =
        rights[rightIndex];

      if (
        right?.actor?.role !==
        "third_party"
      ) {
        continue;
      }

      const name =
        clean(
          right.third_party_name,
        );

      if (!name) {
        continue;
      }

      stats.thirdPartyRights +=
        1;

      let target = null;

      if (
        right.third_party_kind ===
        "organization"
      ) {
        const stable =
          stableOrganizationNode({
            name,

            edrpou:
              right
                .third_party_edrpou,

            sourceDocumentId:
              row.source_document_id,
          });

        if (stable) {
          target = stable;
        } else {
          target =
            observationNode({
              entityType:
                "organization_observation",

              name,

              sourceDocumentId:
                row.source_document_id,
            });
        }
      } else if (
        right.third_party_kind ===
        "person"
      ) {
        target =
          observationNode({
            entityType:
              "person_observation",

            name,

            sourceDocumentId:
              row.source_document_id,
          });

        if (target) {
          registerPerson(
            target,
            row,
            {
              context:
                "third_party_right",

              fact_id:
                row.id,

              asset_kind:
                row.fact_type,

              ownership_type:
                clean(
                  right
                    .ownership_type,
                ),

              other_ownership:
                clean(
                  right
                    .other_ownership,
                ),

              share_percent:
                right
                  .share_percent ??
                null,
            },
          );
        }
      } else {
        stats
          .deferredThirdParties +=
          1;

        continue;
      }

      if (!target) {
        stats
          .deferredThirdParties +=
          1;

        continue;
      }

      nodes.set(
        target.nodeKey,
        target,
      );

      const relationKey =
        stableFingerprint(
          VERSION,
          "third_party_rightsholder",

          assetId,
          target.id,

          row.declaration_year,
          row.source_document_id,
        );

      const evidence = {
        fact_id:
          row.id,

        right_index:
          rightIndex,

        ownership_type:
          clean(
            right.ownership_type,
          ),

        other_ownership:
          clean(
            right.other_ownership,
          ),

        share_percent:
          right.share_percent ??
          null,
      };

      const existing =
        relations.get(
          relationKey,
        );

      if (existing) {
        existing.metadata
          .evidence.push(
            evidence,
          );

        existing.metadata
          .evidence_count =
          existing
            .metadata
            .evidence
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
            assetId,

          toEntityId:
            target.id,

          relationType:
            "third_party_rightsholder",

          sourceDocumentId:
            row.source_document_id,

          validFrom:
            dateForYear(
              row.declaration_year,
            ),

          validTo:
            dateForYear(
              row.declaration_year,
              true,
            ),

          confidence: 100,

          metadata: {
            graph_version:
              VERSION,

            declaration_year:
              row.declaration_year,

            asset_kind:
              row.fact_type,

            third_party_kind:
              right
                .third_party_kind,

            evidence: [
              evidence,
            ],

            evidence_count: 1,

            relation_semantics:
              "Особа або організація зазначена в rights конкретного об'єкта декларації; тип права зберігається окремо у metadata.",
          },
        },
      );
    }
  }

  const nodeList =
    [...nodes.values()];

  const relationList =
    [...relations.values()];

  const peopleList =
    [...people.values()];

  stats.familyRelations =
    relationList.filter(
      (relation) =>
        relation.relationType ===
        "family_member_observed",
    ).length;

  stats.thirdPartyRelations =
    relationList.filter(
      (relation) =>
        relation.relationType ===
        "third_party_rightsholder",
    ).length;

  stats.personObservationNodes =
    nodeList.filter(
      (node) =>
        node.entityType ===
        "person_observation",
    ).length;

  stats.organizationObservationNodes =
    nodeList.filter(
      (node) =>
        node.entityType ===
        "organization_observation",
    ).length;

  stats.stableOrganizationNodes =
    nodeList.filter(
      (node) =>
        node.entityType ===
        "organization",
    ).length;

  return {
    version:
      VERSION,

    nodes:
      nodeList,

    relations:
      relationList,

    personObservations:
      peopleList,

    stats,
  };
}

async function loadLatestRows(
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
      f.fact_type,
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

    WHERE
      f.fact_type IN (
        'family_member',
        'real_estate',
        'vehicle'
      )

    ORDER BY
      l.entity_id,
      l.declaration_year,
      f.fact_type,
      f.id
  `;
}

export async function buildFamilyThirdPartyGraphPlan(
  options = {},
) {
  const sql =
    options.sql ?? db();

  const rows =
    options.rows ??
    await loadLatestRows(sql);

  return buildFamilyThirdPartyPlan(
    rows,
  );
}

export async function persistFamilyThirdPartyGraph(
  plan,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const graph =
    await persistRelationsGraph(
      {
        nodes:
          plan.nodes,

        relations:
          plan.relations,
      },
      { sql },
    );

  const resolutionStats = {
    processed: 0,

    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    conflict: 0,
  };

  const resolutionRelations =
    [];

  for (
    const observation
    of plan.personObservations
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

    resolutionStats.processed +=
      1;

    if (
      Object.hasOwn(
        resolutionStats,
        result.status,
      )
    ) {
      resolutionStats[
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
          family_third_party: {
            observation_node_id:
              observation.nodeId,

            contexts:
              observation.contexts,
          },
        })}::jsonb

      WHERE id =
        ${result.observationId}
    `;

    await sql`
      UPDATE entities

      SET metadata =
        COALESCE(
          metadata,
          '{}'::jsonb
        )
        ||
        ${JSON.stringify({
          identity_resolution: {
            status:
              result.status,

            resolved_entity_id:
              result.entityId ??
              null,

            score:
              result.score ??
              null,

            observation_id:
              result
                .observationId,
          },
        })}::jsonb,

        updated_at = now()

      WHERE id =
        ${observation.nodeId}
    `;

    if (
      result.status !==
        "matched" ||
      !result.entityId
    ) {
      continue;
    }

    const relationKey =
      stableFingerprint(
        VERSION,
        "resolved_to",

        observation.nodeId,
        result.entityId,
      );

    resolutionRelations.push({
      id:
        deterministicUuid(
          "relation",
          relationKey,
        ),

      relationKey,

      fromEntityId:
        observation.nodeId,

      toEntityId:
        result.entityId,

      relationType:
        "resolved_to",

      sourceDocumentId:
        observation
          .sourceDocumentId,

      validFrom:
        dateForYear(
          observation
            .declarationYear,
        ),

      validTo:
        dateForYear(
          observation
            .declarationYear,
          true,
        ),

      confidence:
        result.score ?? 100,

      metadata: {
        graph_version:
          VERSION,

        resolution_status:
          result.status,

        resolution_level:
          result.level,

        observation_id:
          result.observationId,
      },
    });
  }

  let resolvedGraph = {
    relationsInserted: 0,
    relationsUpdated: 0,
  };

  if (
    resolutionRelations.length
  ) {
    resolvedGraph =
      await persistRelationsGraph(
        {
          nodes: [],
          relations:
            resolutionRelations,
        },
        { sql },
      );
  }

  return {
    graph,

    resolutionStats,

    resolvedRelations:
      resolutionRelations.length,

    resolvedRelationsInserted:
      resolvedGraph
        .relationsInserted ??
      0,

    resolvedRelationsUpdated:
      resolvedGraph
        .relationsUpdated ??
      0,
  };
}
