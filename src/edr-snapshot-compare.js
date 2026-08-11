import {
  compareEdrSnapshotRecords,
} from "./edr-snapshot-diff.js";

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
getEdrSnapshotDescriptor(
  sql,
  snapshotId,
) {
  requireSql(sql);

  const id =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const rows =
    await sql`
      SELECT
        id,
        version_key,
        schema_version,
        status,
        discovered_at,
        completed_at,
        organization_count,
        fop_count,
        relation_count
      FROM edr_snapshots
      WHERE id = ${id}
      LIMIT 1
    `;

  return (
    rows[0] ??
    null
  );
}

export async function
loadEdrSnapshotRecords(
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
      id,
      snapshot_id,
      record_type,
      record_number,
      source_sequence,
      name,
      edrpou,
      content_hash
    FROM edr_records
    WHERE snapshot_id =
      ${id}
    ORDER BY
      source_sequence ASC,
      id ASC
  `;
}

function requireReadySnapshot(
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
compareEdrSnapshots(
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

  requireReadySnapshot(
    oldSnapshot,
    "old",
  );

  const newSnapshot =
    await getEdrSnapshotDescriptor(
      sql,
      newId,
    );

  requireReadySnapshot(
    newSnapshot,
    "new",
  );

  const oldRecords =
    await loadEdrSnapshotRecords(
      sql,
      oldId,
    );

  const newRecords =
    await loadEdrSnapshotRecords(
      sql,
      newId,
    );

  const comparison =
    compareEdrSnapshotRecords({
      oldRecords,
      newRecords,
    });

  return {
    old_snapshot:
      oldSnapshot,

    new_snapshot:
      newSnapshot,

    old_record_count:
      oldRecords.length,

    new_record_count:
      newRecords.length,

    ...comparison,
  };
}
