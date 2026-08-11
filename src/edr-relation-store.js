import {
  db,
} from "./db.js";

import {
  normalizeText,
} from "./utils.js";

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

function mergeUnique(
  left,
  right,
) {
  return [
    ...new Set([
      ...(left ?? []),
      ...(right ?? []),
    ].filter(Boolean)),
  ].sort();
}

export function mergeEdrGraphMetadata(
  existing,
  incoming,
) {
  const left =
    asObject(existing);

  const right =
    asObject(incoming);

  const result = {
    ...left,
    ...right,
  };

  const sources =
    mergeUnique(
      [
        ...(
          Array.isArray(
            left.sources,
          )
            ? left.sources
            : []
        ),
        left.source,
      ],
      [
        ...(
          Array.isArray(
            right.sources,
          )
            ? right.sources
            : []
        ),
        right.source,
      ],
    );

  if (sources.length) {
    result.sources =
      sources;
  }

  if (
    Array.isArray(
      left.observation_ids,
    ) ||
    Array.isArray(
      right.observation_ids,
    )
  ) {
    result.observation_ids =
      mergeUnique(
        left.observation_ids,
        right.observation_ids,
      );

    result.evidence_count =
      result.observation_ids.length;
  }

  if (
    Array.isArray(
      left.snapshot_ids,
    ) ||
    Array.isArray(
      right.snapshot_ids,
    )
  ) {
    result.snapshot_ids =
      mergeUnique(
        left.snapshot_ids,
        right.snapshot_ids,
      );
  }

  return result;
}

function validatePlan(plan) {
  if (
    !plan ||
    !Array.isArray(plan.nodes) ||
    !Array.isArray(plan.relations)
  ) {
    throw new TypeError(
      "plan nodes and relations are required",
    );
  }

  for (const node of plan.nodes) {
    if (
      node?.entityType !==
        "organization" ||
      node?.identifier?.type !==
        "edrpou" ||
      node?.metadata?.source !==
        "edr"
    ) {
      throw new TypeError(
        "Invalid EDR organization graph node",
      );
    }
  }

  for (
    const relation
    of plan.relations
  ) {
    if (
      relation?.verificationStatus !==
        "manual_review" ||
      relation?.metadata?.source !==
        "edr"
    ) {
      throw new TypeError(
        "EDR graph relation must require manual review",
      );
    }
  }
}

async function persistNode(
  sql,
  node,
  planVersion,
  stats,
) {
  const existingRows =
    await sql`
      SELECT
        id,
        metadata
      FROM entities
      WHERE id = ${node.id}
      LIMIT 1
    `;

  const existing =
    existingRows[0] ??
    null;

  const metadata =
    mergeEdrGraphMetadata(
      existing?.metadata,
      node.metadata,
    );

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
      active,
      ${JSON.stringify(
        metadata,
      )}::jsonb
    )
    ON CONFLICT (id)
    DO UPDATE SET
      canonical_name =
        EXCLUDED.canonical_name,
      normalized_name =
        EXCLUDED.normalized_name,
      metadata =
        EXCLUDED.metadata,
      updated_at =
        now()
  `;

  if (existing) {
    stats.nodesUpdated += 1;
  } else {
    stats.nodesInserted += 1;
  }

  const identifierRows =
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

  if (!identifierRows.length) {
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
        edr,
        ${node.identifier.confidence},
        true,
        NULL,
        ${JSON.stringify({
          graph_version:
            planVersion,
          source:
            "edr",
        })}::jsonb
      )
    `;

    stats.identifiersInserted +=
      1;
  }
}

async function persistRelation(
  sql,
  relation,
  stats,
) {
  const existingRows =
    await sql`
      SELECT
        id,
        confidence,
        metadata
      FROM relations
      WHERE id =
        ${relation.id}
      LIMIT 1
    `;

  const existing =
    existingRows[0] ??
    null;

  const metadata =
    mergeEdrGraphMetadata(
      existing?.metadata,
      relation.metadata,
    );

  const confidence =
    Math.max(
      Number(
        existing?.confidence,
      ) || 0,
      Number(
        relation.confidence,
      ) || 0,
    );

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
      NULL,
      ${relation.validFrom}::date,
      ${relation.validTo}::date,
      ${confidence},
      manual_review,
      ${JSON.stringify(
        metadata,
      )}::jsonb
    )
    ON CONFLICT (id)
    DO UPDATE SET
      from_entity_id =
        EXCLUDED.from_entity_id,
      to_entity_id =
        EXCLUDED.to_entity_id,
      relation_type =
        EXCLUDED.relation_type,
      confidence =
        GREATEST(
          relations.confidence,
          EXCLUDED.confidence
        ),
      verification_status =
        EXCLUDED.verification_status,
      metadata =
        EXCLUDED.metadata
  `;

  if (existing) {
    stats.relationsUpdated +=
      1;
  } else {
    stats.relationsInserted +=
      1;
  }
}

export async function persistEdrSubjectRelationPlan(
  plan,
  options = {},
) {
  validatePlan(plan);

  const sql =
    options.sql ??
    db();

  if (typeof sql !== "function") {
    throw new TypeError(
      "sql must be a tagged-template function",
    );
  }

  const stats = {
    nodesInserted: 0,
    nodesUpdated: 0,

    identifiersInserted: 0,

    relationsInserted: 0,
    relationsUpdated: 0,
  };

  for (const node of plan.nodes) {
    await persistNode(
      sql,
      node,
      plan.version ??
        "edr-relations-v1",
      stats,
    );
  }

  for (
    const relation
    of plan.relations
  ) {
    await persistRelation(
      sql,
      relation,
      stats,
    );
  }

  return stats;
}
