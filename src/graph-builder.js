import { db } from "./db.js";

import {
  normalizeText,
  stableFingerprint,
} from "./utils.js";

const VERSION =
  "relations-graph-v1";

function clean(value) {
  const result =
    String(value ?? "")
      .trim();

  return result || null;
}

function numeric(value) {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : null;
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ].sort();
}

export function deterministicUuid(
  ...parts
) {
  const chars =
    stableFingerprint(
      "graph-uuid",
      ...parts,
    )
      .slice(0, 32)
      .split("");

  /*
   * UUID-like deterministic identifier.
   * Version/variant bits are normalized.
   */
  chars[12] = "5";

  chars[16] = (
    (
      parseInt(
        chars[16],
        16,
      ) & 0x3
    ) | 0x8
  ).toString(16);

  const hex =
    chars.join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function normalizeEdrpou(
  value,
) {
  const digits =
    String(value ?? "")
      .replace(/\D/g, "");

  return digits.length === 8
    ? digits
    : null;
}

function thirdPartyNames(
  valueJson,
) {
  return unique(
    (
      valueJson?.rights ??
      []
    )
      .map(
        (right) =>
          clean(
            right
              ?.third_party_name,
          ),
      )
      .map(
        (value) =>
          value
            ? normalizeText(value)
            : null,
      ),
  );
}

function holderRoles(
  valueJson,
) {
  return unique([
    valueJson?.person?.role,

    ...(
      valueJson?.rights ??
      []
    ).map(
      (right) =>
        right?.actor?.role,
    ),
  ]);
}

function ownershipTypes(
  valueJson,
) {
  return unique(
    (
      valueJson?.rights ??
      []
    ).map(
      (right) =>
        clean(
          right
            ?.ownership_type,
        ),
    ),
  );
}

function realEstateIdentity(
  fact,
) {
  const value =
    fact.value_json ?? {};

  const objectType =
    clean(
      value.object_type ??
      fact.value_text,
    );

  const otherType =
    clean(
      value.other_object_type,
    );

  const area =
    numeric(
      value.total_area ??
      fact.value_number,
    );

  const acquisitionDate =
    clean(
      value.acquisition_date,
    );

  const country =
    clean(value.country);

  const region =
    clean(value.region);

  const district =
    clean(value.district);

  const city =
    clean(value.city);

  const thirdParties =
    thirdPartyNames(value);

  let confidence = 0;

  if (objectType) {
    confidence += 15;
  }

  if (area !== null) {
    confidence += 25;
  }

  if (acquisitionDate) {
    confidence += 20;
  }

  if (city) {
    confidence += 15;
  }

  if (region) {
    confidence += 10;
  }

  if (country) {
    confidence += 5;
  }

  if (
    thirdParties.length
  ) {
    confidence += 10;
  }

  if (confidence < 70) {
    return null;
  }

  const roundedArea =
    area === null
      ? null
      : Math.round(
          area * 100,
        ) / 100;

  const fingerprint =
    stableFingerprint(
      VERSION,
      "real_estate",

      objectType ?? "",
      otherType ?? "",

      country ?? "",
      region ?? "",
      district ?? "",
      city ?? "",

      roundedArea ?? "",

      acquisitionDate ?? "",

      thirdParties.join("|"),
    );

  const canonicalName =
    [
      objectType ??
        "Нерухомість",

      city,

      roundedArea !== null
        ? `${roundedArea} м²`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return {
    kind: "real_estate",

    fingerprint,
    confidence,

    canonicalName,

    metadata: {
      graph_version:
        VERSION,

      asset_kind:
        "real_estate",

      object_type:
        objectType,

      other_object_type:
        otherType,

      country,
      region,
      district,
      city,

      area:
        roundedArea,

      acquisition_date:
        acquisitionDate,

      identity_confidence:
        confidence,
    },
  };
}

function vehicleIdentity(
  fact,
) {
  const value =
    fact.value_json ?? {};

  const brand =
    clean(value.brand);

  const model =
    clean(value.model);

  const productionYear =
    numeric(
      value.production_year,
    );

  const acquisitionDate =
    clean(
      value.acquisition_date,
    );

  let confidence = 0;

  if (brand) {
    confidence += 25;
  }

  if (model) {
    confidence += 25;
  }

  if (
    productionYear !== null
  ) {
    confidence += 20;
  }

  if (acquisitionDate) {
    confidence += 20;
  }

  if (confidence < 70) {
    return null;
  }

  const fingerprint =
    stableFingerprint(
      VERSION,
      "vehicle",

      brand ?? "",
      model ?? "",

      productionYear ?? "",

      acquisitionDate ?? "",
    );

  const canonicalName =
    [
      brand,
      model,
      productionYear,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Транспортний засіб";

  return {
    kind: "vehicle",

    fingerprint,
    confidence,

    canonicalName,

    metadata: {
      graph_version:
        VERSION,

      asset_kind:
        "vehicle",

      brand,
      model,

      production_year:
        productionYear,

      acquisition_date:
        acquisitionDate,

      identity_confidence:
        confidence,
    },
  };
}

export function assetIdentity(
  fact,
) {
  if (
    fact.fact_type ===
    "real_estate"
  ) {
    return realEstateIdentity(
      fact,
    );
  }

  if (
    fact.fact_type ===
    "vehicle"
  ) {
    return vehicleIdentity(
      fact,
    );
  }

  return null;
}

function organizationNode(
  row,
) {
  const workplace =
    clean(
      row.value_json
        ?.workplace,
    );

  const edrpou =
    normalizeEdrpou(
      row.value_json
        ?.workplace_edrpou,
    );

  if (
    !workplace ||
    !edrpou
  ) {
    return null;
  }

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
      workplace,

    identifier: {
      type: "edrpou",
      value: edrpou,
      normalized: edrpou,
      confidence: 100,
    },

    sourceDocumentId:
      row.source_document_id,

    metadata: {
      graph_version:
        VERSION,

      identification:
        "edrpou",

      edrpou,
    },
  };
}

function assetNode(
  row,
  identity,
) {
  const nodeKey =
    `asset:${identity.fingerprint}`;

  return {
    nodeKey,

    id:
      deterministicUuid(
        nodeKey,
      ),

    entityType:
      "asset",

    canonicalName:
      identity.canonicalName,

    identifier: {
      type:
        "asset_fingerprint",

      value:
        identity.fingerprint,

      normalized:
        identity.fingerprint,

      confidence:
        identity.confidence,
    },

    sourceDocumentId:
      row.source_document_id,

    metadata:
      identity.metadata,
  };
}

function relationId(
  key,
) {
  return deterministicUuid(
    "relation",
    key,
  );
}

function yearDate(
  year,
  end = false,
) {
  return end
    ? `${year}-12-31`
    : `${year}-01-01`;
}

function mergeArray(
  left,
  right,
) {
  return unique([
    ...(left ?? []),
    ...(right ?? []),
  ]);
}

export function buildPlanFromRows(
  rows,
) {
  const nodes =
    new Map();

  const relations =
    new Map();

  const stats = {
    rows:
      rows.length,

    organizations: 0,
    assets: 0,

    employedByRelations: 0,
    declaredAssetRelations: 0,

    weakAssetsSkipped: 0,

    incomeSourcesDeferred: 0,
    familyPersonsDeferred: 0,
  };

  for (const row of rows) {
    if (
      row.fact_type ===
      "employment"
    ) {
      const node =
        organizationNode(row);

      if (node) {
        nodes.set(
          node.nodeKey,
          node,
        );

        const relationKey =
          stableFingerprint(
            VERSION,
            "employed_by",

            row.subject_id,
            node.id,

            row.year,
            row.source_document_id,
          );

        relations.set(
          relationKey,
          {
            id:
              relationId(
                relationKey,
              ),

            relationKey,

            fromEntityId:
              row.subject_id,

            toEntityId:
              node.id,

            relationType:
              "employed_by",

            sourceDocumentId:
              row.source_document_id,

            validFrom:
              yearDate(
                row.year,
              ),

            validTo:
              yearDate(
                row.year,
                true,
              ),

            confidence: 100,

            metadata: {
              graph_version:
                VERSION,

              declaration_year:
                row.year,

              workplace:
                clean(
                  row.value_json
                    ?.workplace,
                ),

              position:
                clean(
                  row.value_json
                    ?.position,
                ),
            },
          },
        );
      }

      continue;
    }

    if (
      row.fact_type ===
        "real_estate" ||
      row.fact_type ===
        "vehicle"
    ) {
      const identity =
        assetIdentity(row);

      if (!identity) {
        stats
          .weakAssetsSkipped += 1;

        continue;
      }

      const node =
        assetNode(
          row,
          identity,
        );

      if (
        !nodes.has(
          node.nodeKey,
        )
      ) {
        nodes.set(
          node.nodeKey,
          node,
        );
      }

      const relationKey =
        stableFingerprint(
          VERSION,
          "declared_asset",

          row.subject_id,
          node.id,

          row.year,
          row.source_document_id,
        );

      const evidence = {
        factIds: [
          row.id,
        ].filter(Boolean),

        holderRoles:
          holderRoles(
            row.value_json,
          ),

        ownershipTypes:
          ownershipTypes(
            row.value_json,
          ),
      };

      const existing =
        relations.get(
          relationKey,
        );

      if (existing) {
        existing.metadata
          .fact_ids =
          mergeArray(
            existing
              .metadata
              .fact_ids,

            evidence.factIds,
          );

        existing.metadata
          .holder_roles =
          mergeArray(
            existing
              .metadata
              .holder_roles,

            evidence
              .holderRoles,
          );

        existing.metadata
          .ownership_types =
          mergeArray(
            existing
              .metadata
              .ownership_types,

            evidence
              .ownershipTypes,
          );

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
            relationId(
              relationKey,
            ),

          relationKey,

          fromEntityId:
            row.subject_id,

          toEntityId:
            node.id,

          relationType:
            "declared_asset",

          sourceDocumentId:
            row.source_document_id,

          validFrom:
            yearDate(
              row.year,
            ),

          validTo:
            yearDate(
              row.year,
              true,
            ),

          confidence: 100,

          metadata: {
            graph_version:
              VERSION,

            declaration_year:
              row.year,

            asset_kind:
              identity.kind,

            asset_identity_confidence:
              identity.confidence,

            fact_ids:
              evidence.factIds,

            holder_roles:
              evidence
                .holderRoles,

            ownership_types:
              evidence
                .ownershipTypes,

            evidence_count:
              evidence
                .factIds
                .length,

            relation_semantics:
              "Об’єкт зазначено у декларації. Це нейтральний зв’язок і не означає автоматично право власності декларанта.",
          },
        },
      );

      continue;
    }

    if (
      row.fact_type ===
      "income" &&
      clean(
        row.value_json
          ?.source,
      )
    ) {
      stats
        .incomeSourcesDeferred += 1;

      continue;
    }

    if (
      row.fact_type ===
      "family_member" &&
      clean(
        row.value_json
          ?.name,
      )
    ) {
      stats
        .familyPersonsDeferred += 1;
    }
  }

  const nodeList =
    [...nodes.values()];

  const relationList =
    [...relations.values()];

  stats.organizations =
    nodeList.filter(
      (node) =>
        node.entityType ===
        "organization",
    ).length;

  stats.assets =
    nodeList.filter(
      (node) =>
        node.entityType ===
        "asset",
    ).length;

  stats.employedByRelations =
    relationList.filter(
      (relation) =>
        relation.relationType ===
        "employed_by",
    ).length;

  stats.declaredAssetRelations =
    relationList.filter(
      (relation) =>
        relation.relationType ===
        "declared_asset",
    ).length;

  return {
    version:
      VERSION,

    nodes:
      nodeList,

    relations:
      relationList,

    stats,
  };
}

async function loadGraphRows(
  sql,
) {
  return sql`
    WITH ranked AS (
      SELECT
        f.entity_id,

        (
          f.value_json
          ->> 'declaration_year'
        )::int AS year,

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
        year,
        source_document_id

      FROM ranked

      WHERE rn = 1
    )

    SELECT
      l.entity_id
        AS subject_id,

      l.year,

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

    WHERE f.fact_type IN (
      'employment',
      'family_member',
      'real_estate',
      'vehicle',
      'income'
    )

    ORDER BY
      l.entity_id,
      l.year,
      f.fact_type,
      f.id
  `;
}

export async function buildRelationsGraphPlan(
  options = {},
) {
  const sql =
    options.sql ?? db();

  const rows =
    options.rows ??
    await loadGraphRows(sql);

  return buildPlanFromRows(
    rows,
  );
}

export async function persistRelationsGraph(
  plan,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const stats = {
    nodesInserted: 0,
    nodesUpdated: 0,

    identifiersInserted: 0,

    relationsInserted: 0,
    relationsUpdated: 0,
  };

  /*
   * Persist graph nodes first.
   */
  for (const node of plan.nodes) {
    const exists =
      await sql`
        SELECT id
        FROM entities
        WHERE id = ${node.id}
        LIMIT 1
      `;

    await sql`
      INSERT INTO entities (
        id,
        entity_type,
        canonical_name,
        normalized_name,
        status,
        metadata
      )

      VALUES (
        ${node.id},
        ${node.entityType},
        ${node.canonicalName},
        ${normalizeText(
          node.canonicalName,
        )},
        'active',
        ${JSON.stringify(
          node.metadata,
        )}::jsonb
      )

      ON CONFLICT (id)
      DO UPDATE SET
        canonical_name =
          EXCLUDED.canonical_name,

        normalized_name =
          EXCLUDED.normalized_name,

        metadata =
          COALESCE(
            entities.metadata,
            '{}'::jsonb
          )
          ||
          EXCLUDED.metadata,

        updated_at =
          now()
    `;

    if (exists.length) {
      stats.nodesUpdated += 1;
    } else {
      stats.nodesInserted += 1;
    }

    const identifierExists =
      await sql`
        SELECT id

        FROM entity_identifiers

        WHERE
          entity_id =
            ${node.id}

          AND identifier_type =
            ${node.identifier.type}

          AND normalized_value =
            ${node.identifier.normalized}

        LIMIT 1
      `;

    if (
      !identifierExists.length
    ) {
      await sql`
        INSERT INTO entity_identifiers (
          entity_id,

          identifier_type,
          identifier_value,
          normalized_value,

          source,
          confidence,
          is_primary,

          source_document_id,

          metadata
        )

        VALUES (
          ${node.id},

          ${node.identifier.type},
          ${node.identifier.value},
          ${node.identifier.normalized},

          'nazk-declaration',
          ${node.identifier.confidence},
          true,

          ${node.sourceDocumentId},

          ${JSON.stringify({
            graph_version:
              VERSION,
          })}::jsonb
        )
      `;

      stats
        .identifiersInserted += 1;
    }
  }

  /*
   * Then persist directed edges.
   */
  for (
    const relation
    of plan.relations
  ) {
    const exists =
      await sql`
        SELECT id

        FROM relations

        WHERE id =
          ${relation.id}

        LIMIT 1
      `;

    const metadata = {
      ...relation.metadata,

      relation_key:
        relation.relationKey,
    };

    await sql`
      INSERT INTO relations (
        id,

        from_entity_id,
        to_entity_id,

        relation_type,

        source_document_id,

        valid_from,
        valid_to,

        confidence,

        verification_status,

        metadata
      )

      VALUES (
        ${relation.id},

        ${relation.fromEntityId},
        ${relation.toEntityId},

        ${relation.relationType},

        ${relation.sourceDocumentId},

        ${relation.validFrom}::date,
        ${relation.validTo}::date,

        ${relation.confidence},

        'source_extracted',

        ${JSON.stringify(
          metadata,
        )}::jsonb
      )

      ON CONFLICT (id)
      DO UPDATE SET
        source_document_id =
          EXCLUDED.source_document_id,

        valid_from =
          EXCLUDED.valid_from,

        valid_to =
          EXCLUDED.valid_to,

        confidence =
          EXCLUDED.confidence,

        verification_status =
          EXCLUDED.verification_status,

        metadata =
          EXCLUDED.metadata
    `;

    if (exists.length) {
      stats.relationsUpdated +=
        1;
    } else {
      stats.relationsInserted +=
        1;
    }
  }

  return stats;
}
