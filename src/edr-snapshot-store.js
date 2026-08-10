export const EDR_SNAPSHOT_STATUSES =
  Object.freeze({
    STAGING:
      "staging",

    READY:
      "ready",

    FAILED:
      "failed",
  });

function requiredText(
  value,
  field,
) {
  const normalized =
    String(value ?? "").trim();

  if (!normalized) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return normalized;
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

function metadataJson(
  value,
) {
  if (
    value == null
  ) {
    return "{}";
  }

  if (
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      "metadata must be an object",
    );
  }

  return JSON.stringify(
    value,
  );
}

export async function
createEdrSnapshot(
  sql,
  {
    versionKey,
    schemaVersion,
    discoveredAt = null,
    metadata = {},
  } = {},
) {
  requireSql(sql);

  const normalizedVersionKey =
    requiredText(
      versionKey,
      "versionKey",
    );

  const normalizedSchemaVersion =
    requiredText(
      schemaVersion,
      "schemaVersion",
    );

  const metadataValue =
    metadataJson(
      metadata,
    );

  const inserted =
    await sql`
      INSERT INTO edr_snapshots (
        version_key,
        schema_version,
        status,
        discovered_at,
        metadata
      )
      VALUES (
        ${normalizedVersionKey},
        ${normalizedSchemaVersion},
        'staging',
        ${discoveredAt},
        ${metadataValue}::jsonb
      )
      ON CONFLICT (
        version_key
      )
      DO NOTHING
      RETURNING *
    `;

  if (
    inserted.length > 0
  ) {
    return {
      created: true,
      snapshot:
        inserted[0],
    };
  }

  const existing =
    await sql`
      SELECT *
      FROM edr_snapshots
      WHERE version_key =
        ${normalizedVersionKey}
      LIMIT 1
    `;

  if (
    existing.length === 0
  ) {
    throw new Error(
      "EDR snapshot conflict could not be resolved",
    );
  }

  return {
    created: false,
    snapshot:
      existing[0],
  };
}

export async function
registerEdrSnapshotResource(
  sql,
  {
    snapshotId,
    resourceType,
    resourceName,
    resourceId,
    sourceUrl,
    sourceLastModified = null,
    expectedSize = null,
    downloadedSize = null,
    sha256 = null,
    metadata = {},
  } = {},
) {
  requireSql(sql);

  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const normalizedType =
    requiredText(
      resourceType,
      "resourceType",
    ).toLowerCase();

  if (
    normalizedType !==
      "organization" &&
    normalizedType !==
      "fop"
  ) {
    throw new TypeError(
      "Unsupported EDR resource type",
    );
  }

  const expected =
    expectedSize == null
      ? null
      : nonNegativeCount(
          expectedSize,
          "expectedSize",
        );

  const downloaded =
    downloadedSize == null
      ? null
      : nonNegativeCount(
          downloadedSize,
          "downloadedSize",
        );

  const rows =
    await sql`
      INSERT INTO
        edr_snapshot_resources (
          snapshot_id,
          resource_type,
          resource_name,
          resource_id,
          source_url,
          source_last_modified,
          expected_size,
          downloaded_size,
          sha256,
          metadata
        )
      SELECT
        s.id,
        ${normalizedType},
        ${requiredText(
          resourceName,
          "resourceName",
        )},
        ${requiredText(
          resourceId,
          "resourceId",
        )},
        ${requiredText(
          sourceUrl,
          "sourceUrl",
        )},
        ${sourceLastModified},
        ${expected},
        ${downloaded},
        ${
          sha256 == null
            ? null
            : requiredText(
                sha256,
                "sha256",
              )
        },
        ${metadataJson(
          metadata,
        )}::jsonb
      FROM edr_snapshots s
      WHERE s.id =
        ${normalizedSnapshotId}
        AND s.status =
          'staging'
      ON CONFLICT (
        snapshot_id,
        resource_type
      )
      DO UPDATE SET
        resource_name =
          EXCLUDED.resource_name,

        resource_id =
          EXCLUDED.resource_id,

        source_url =
          EXCLUDED.source_url,

        source_last_modified =
          EXCLUDED.source_last_modified,

        expected_size =
          EXCLUDED.expected_size,

        downloaded_size =
          EXCLUDED.downloaded_size,

        sha256 =
          EXCLUDED.sha256,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          now()
      RETURNING *
    `;

  if (
    rows.length === 0
  ) {
    throw new Error(
      "EDR snapshot is not staging or does not exist",
    );
  }

  return rows[0];
}

export async function
markEdrSnapshotReady(
  sql,
  {
    snapshotId,
    organizationCount,
    fopCount,
    relationCount,
  } = {},
) {
  requireSql(sql);

  const rows =
    await sql`
      UPDATE edr_snapshots
      SET
        status =
          'ready',

        organization_count =
          ${nonNegativeCount(
            organizationCount,
            "organizationCount",
          )},

        fop_count =
          ${nonNegativeCount(
            fopCount,
            "fopCount",
          )},

        relation_count =
          ${nonNegativeCount(
            relationCount,
            "relationCount",
          )},

        completed_at =
          now(),

        failed_at =
          NULL,

        error_text =
          NULL,

        updated_at =
          now()

      WHERE id =
        ${requiredText(
          snapshotId,
          "snapshotId",
        )}

        AND status =
          'staging'

      RETURNING *
    `;

  if (
    rows.length === 0
  ) {
    throw new Error(
      "EDR snapshot cannot transition to ready",
    );
  }

  return rows[0];
}

export async function
markEdrSnapshotFailed(
  sql,
  {
    snapshotId,
    error,
  } = {},
) {
  requireSql(sql);

  const errorText =
    error instanceof Error
      ? error.message
      : requiredText(
          error,
          "error",
        );

  const rows =
    await sql`
      UPDATE edr_snapshots
      SET
        status =
          'failed',

        failed_at =
          now(),

        completed_at =
          NULL,

        error_text =
          ${errorText},

        updated_at =
          now()

      WHERE id =
        ${requiredText(
          snapshotId,
          "snapshotId",
        )}

        AND status =
          'staging'

      RETURNING *
    `;

  if (
    rows.length === 0
  ) {
    throw new Error(
      "EDR snapshot cannot transition to failed",
    );
  }

  return rows[0];
}

export async function
activateEdrSnapshot(
  sql,
  {
    snapshotId,
  } = {},
) {
  requireSql(sql);

  const rows =
    await sql`
      WITH candidate AS (
        SELECT id
        FROM edr_snapshots
        WHERE id =
          ${requiredText(
            snapshotId,
            "snapshotId",
          )}
          AND status =
            'ready'
      )

      INSERT INTO
        edr_active_snapshot (
          singleton,
          snapshot_id,
          activated_at
        )

      SELECT
        true,
        candidate.id,
        now()

      FROM candidate

      ON CONFLICT (
        singleton
      )
      DO UPDATE SET
        snapshot_id =
          EXCLUDED.snapshot_id,

        activated_at =
          EXCLUDED.activated_at

      RETURNING
        snapshot_id,
        activated_at
    `;

  if (
    rows.length === 0
  ) {
    throw new Error(
      "EDR snapshot is not ready for activation",
    );
  }

  return rows[0];
}

export async function
getActiveEdrSnapshot(
  sql,
) {
  requireSql(sql);

  const rows =
    await sql`
      SELECT
        s.*,
        a.activated_at

      FROM edr_active_snapshot a

      JOIN edr_snapshots s
        ON s.id =
          a.snapshot_id

      WHERE a.singleton =
        true

      LIMIT 1
    `;

  return (
    rows[0] ??
    null
  );
}
