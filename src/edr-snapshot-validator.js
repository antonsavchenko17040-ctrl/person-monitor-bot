function requiredText(
  value,
  field,
) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return text;
}

function requireSql(
  sql,
) {
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

function nonNegativeCount(
  value,
  field,
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new TypeError(
      `${field} must be a non-negative safe integer`,
    );
  }

  return number;
}

function nullableSequence(
  value,
  field,
) {
  if (
    value == null
  ) {
    return null;
  }

  return nonNegativeCount(
    value,
    field,
  );
}

function normalizeResourceType(
  value,
) {
  const type =
    requiredText(
      value,
      "resourceType",
    ).toLowerCase();

  if (
    type !== "organization" &&
    type !== "fop"
  ) {
    throw new TypeError(
      "Unsupported EDR resource type",
    );
  }

  return type;
}

export async function
setEdrSnapshotResourceImportedCount(
  sql,
  {
    snapshotId,
    resourceType,
    importedCount,
  } = {},
) {
  requireSql(sql);

  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const normalizedResourceType =
    normalizeResourceType(
      resourceType,
    );

  const normalizedImportedCount =
    nonNegativeCount(
      importedCount,
      "importedCount",
    );

  const rows =
    await sql`
      UPDATE edr_snapshot_resources r
      SET
        imported_count =
          ${normalizedImportedCount},

        updated_at =
          now()

      FROM edr_snapshots s

      WHERE r.snapshot_id =
        ${normalizedSnapshotId}

        AND r.resource_type =
          ${normalizedResourceType}

        AND s.id =
          r.snapshot_id

        AND s.status =
          'staging'

      RETURNING r.*
    `;

  if (
    rows.length === 0
  ) {
    throw new Error(
      "EDR staging snapshot resource was not found",
    );
  }

  return rows[0];
}

export async function
loadEdrSnapshotValidationStats(
  sql,
  {
    snapshotId,
  } = {},
) {
  requireSql(sql);

  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const rows =
    await sql`
      SELECT
        s.id,
        s.status,

        (
          SELECT count(*)::int
          FROM edr_snapshot_resources resource
          WHERE resource.snapshot_id =
            s.id
        ) AS resource_count,

        (
          SELECT
            COALESCE(
              sum(resource.imported_count),
              0
            )::bigint
          FROM edr_snapshot_resources resource
          WHERE resource.snapshot_id =
            s.id
            AND resource.resource_type =
              'organization'
        ) AS organization_resource_count,

        (
          SELECT
            COALESCE(
              sum(resource.imported_count),
              0
            )::bigint
          FROM edr_snapshot_resources resource
          WHERE resource.snapshot_id =
            s.id
            AND resource.resource_type =
              'fop'
        ) AS fop_resource_count,

        (
          SELECT count(*)::bigint
          FROM edr_records record
          WHERE record.snapshot_id =
            s.id
            AND record.record_type =
              'organization'
        ) AS organization_count,

        (
          SELECT count(*)::bigint
          FROM edr_records record
          WHERE record.snapshot_id =
            s.id
            AND record.record_type =
              'fop'
        ) AS fop_count,

        (
          SELECT count(*)::bigint
          FROM edr_relation_observations relation
          WHERE relation.snapshot_id =
            s.id
        ) AS relation_count,

        (
          SELECT min(
            record.source_sequence
          )::bigint
          FROM edr_records record
          WHERE record.snapshot_id =
            s.id
        ) AS min_source_sequence,

        (
          SELECT max(
            record.source_sequence
          )::bigint
          FROM edr_records record
          WHERE record.snapshot_id =
            s.id
        ) AS max_source_sequence,

        (
          SELECT count(*)::bigint
          FROM edr_relation_observations relation
          JOIN edr_records record
            ON record.id =
              relation.record_id
          WHERE relation.snapshot_id =
            s.id
            AND record.snapshot_id <>
              relation.snapshot_id
        ) AS cross_snapshot_relation_count

      FROM edr_snapshots s

      WHERE s.id =
        ${normalizedSnapshotId}

      LIMIT 1
    `;

  if (
    rows.length === 0
  ) {
    return null;
  }

  const row =
    rows[0];

  return {
    snapshot_id:
      row.id,

    status:
      row.status,

    resource_count:
      nonNegativeCount(
        row.resource_count,
        "resource_count",
      ),

    organization_resource_count:
      nonNegativeCount(
        row.organization_resource_count,
        "organization_resource_count",
      ),

    fop_resource_count:
      nonNegativeCount(
        row.fop_resource_count,
        "fop_resource_count",
      ),

    organization_count:
      nonNegativeCount(
        row.organization_count,
        "organization_count",
      ),

    fop_count:
      nonNegativeCount(
        row.fop_count,
        "fop_count",
      ),

    relation_count:
      nonNegativeCount(
        row.relation_count,
        "relation_count",
      ),

    min_source_sequence:
      nullableSequence(
        row.min_source_sequence,
        "min_source_sequence",
      ),

    max_source_sequence:
      nullableSequence(
        row.max_source_sequence,
        "max_source_sequence",
      ),

    cross_snapshot_relation_count:
      nonNegativeCount(
        row.cross_snapshot_relation_count,
        "cross_snapshot_relation_count",
      ),
  };
}

export async function
validateEdrSnapshotCounts(
  sql,
  {
    snapshotId,
    organizationCount,
    fopCount,
    relationCount,
  } = {},
) {
  const expectedOrganizationCount =
    nonNegativeCount(
      organizationCount,
      "organizationCount",
    );

  const expectedFopCount =
    nonNegativeCount(
      fopCount,
      "fopCount",
    );

  const expectedRelationCount =
    nonNegativeCount(
      relationCount,
      "relationCount",
    );

  const stats =
    await loadEdrSnapshotValidationStats(
      sql,
      {
        snapshotId,
      },
    );

  if (!stats) {
    throw new Error(
      "EDR snapshot was not found",
    );
  }

  if (
    stats.status !==
    "staging"
  ) {
    throw new Error(
      "EDR snapshot validation requires staging status",
    );
  }

  if (
    stats.resource_count !==
    2
  ) {
    throw new Error(
      "EDR snapshot must contain exactly two resources",
    );
  }

  if (
    stats.organization_resource_count !==
    expectedOrganizationCount
  ) {
    throw new Error(
      "EDR organization resource count mismatch",
    );
  }

  if (
    stats.fop_resource_count !==
    expectedFopCount
  ) {
    throw new Error(
      "EDR FOP resource count mismatch",
    );
  }

  if (
    stats.organization_count !==
    expectedOrganizationCount
  ) {
    throw new Error(
      "EDR organization record count mismatch",
    );
  }

  if (
    stats.fop_count !==
    expectedFopCount
  ) {
    throw new Error(
      "EDR FOP record count mismatch",
    );
  }

  if (
    stats.relation_count !==
    expectedRelationCount
  ) {
    throw new Error(
      "EDR relation count mismatch",
    );
  }

  if (
    stats.cross_snapshot_relation_count !==
    0
  ) {
    throw new Error(
      "EDR snapshot contains cross-snapshot relations",
    );
  }

  const totalRecords =
    expectedOrganizationCount +
    expectedFopCount;

  if (
    totalRecords === 0
  ) {
    if (
      stats.min_source_sequence !== null ||
      stats.max_source_sequence !== null
    ) {
      throw new Error(
        "EDR empty snapshot has unexpected source sequence",
      );
    }
  } else if (
    stats.min_source_sequence !== 0 ||
    stats.max_source_sequence !==
      totalRecords - 1
  ) {
    throw new Error(
      "EDR source sequence is not contiguous",
    );
  }

  return {
    ok: true,
    ...stats,
    total_records:
      totalRecords,
  };
}
