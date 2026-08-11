import {
  getEdrSnapshotDescriptor,
} from "./edr-snapshot-compare.js";

import {
  compareEdrRelationObservations,
} from "./edr-relation-diff.js";

function requiredText(
  value,
  field,
) {
  const result =
    String(value ?? "").trim();

  if (!result) {
    throw new TypeError(
      field + " is required",
    );
  }

  return result;
}

function requireSql(sql) {
  if (
    typeof sql !==
      "function"
  ) {
    throw new TypeError(
      "sql must be a tagged-template function",
    );
  }

  return sql;
}

export async function
loadEdrSnapshotRelations(
  sql,
  snapshotId,
) {
  requireSql(sql);

  const id =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  return sql`
    SELECT
      observation.id,
      observation.snapshot_id,
      observation.record_id,
      observation.relation_type,
      observation.ordinal,
      observation.value_text,
      observation.normalized_value,
      observation.value_code,

      record.record_type,
      record.name
        AS record_name,
      record.edrpou
        AS record_edrpou

    FROM edr_relation_observations
      AS observation

    JOIN edr_records
      AS record
      ON record.id =
        observation.record_id
      AND record.snapshot_id =
        observation.snapshot_id

    WHERE observation.snapshot_id =
      ${id}

    ORDER BY
      record.source_sequence ASC,
      observation.relation_type ASC,
      observation.ordinal ASC,
      observation.id ASC
  `;
}

function requireReady(
  snapshot,
  label,
) {
  if (!snapshot) {
    throw new Error(
      label +
      " snapshot not found",
    );
  }

  if (
    snapshot.status !==
      "ready"
  ) {
    throw new Error(
      label +
      " snapshot must be ready",
    );
  }
}

export async function
compareEdrSnapshotRelations(
  sql,
  {
    oldSnapshotId,
    newSnapshotId,
  } = {},
) {
  requireSql(sql);

  const oldId =
    requiredText(
      oldSnapshotId,
      "oldSnapshotId",
    );

  const newId =
    requiredText(
      newSnapshotId,
      "newSnapshotId",
    );

  if (oldId === newId) {
    throw new TypeError(
      "snapshot ids must be different",
    );
  }

  const oldSnapshot =
    await getEdrSnapshotDescriptor(
      sql,
      oldId,
    );

  requireReady(
    oldSnapshot,
    "old",
  );

  const newSnapshot =
    await getEdrSnapshotDescriptor(
      sql,
      newId,
    );

  requireReady(
    newSnapshot,
    "new",
  );

  const oldRelations =
    await loadEdrSnapshotRelations(
      sql,
      oldId,
    );

  const newRelations =
    await loadEdrSnapshotRelations(
      sql,
      newId,
    );

  return {
    old_snapshot:
      oldSnapshot,

    new_snapshot:
      newSnapshot,

    old_relation_count:
      oldRelations.length,

    new_relation_count:
      newRelations.length,

    comparison:
      compareEdrRelationObservations(
        oldRelations,
        newRelations,
      ),
  };
}
