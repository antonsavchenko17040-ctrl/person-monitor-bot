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

function requireFunction(
  value,
  field,
) {
  if (
    typeof value !==
    "function"
  ) {
    throw new TypeError(
      `${field} must be a function`,
    );
  }

  return value;
}

function failureText(
  error,
) {
  if (
    error instanceof Error
  ) {
    return (
      error.message.trim() ||
      error.name ||
      "Unknown EDR snapshot failure"
    );
  }

  return requiredText(
    error,
    "error",
  );
}

export async function
failEdrSnapshotIfStaging(
  sql,
  {
    snapshotId,
    error,
  } = {},
) {
  requireSql(sql);

  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const normalizedError =
    failureText(
      error,
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
          ${normalizedError},

        updated_at =
          now()

      WHERE id =
        ${normalizedSnapshotId}

        AND status =
          'staging'

      RETURNING *
    `;

  return (
    rows[0] ??
    null
  );
}

export async function
runEdrSnapshotWithFailureGuard(
  sql,
  {
    snapshotId,
    work,
    failSnapshot =
      failEdrSnapshotIfStaging,
  } = {},
) {
  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const operation =
    requireFunction(
      work,
      "work",
    );

  const failureMarker =
    requireFunction(
      failSnapshot,
      "failSnapshot",
    );

  try {
    return await operation(
      sql,
      {
        snapshotId:
          normalizedSnapshotId,
      },
    );
  } catch (error) {
    try {
      await failureMarker(
        sql,
        {
          snapshotId:
            normalizedSnapshotId,
          error,
        },
      );
    } catch (failureError) {
      throw new AggregateError(
        [
          error,
          failureError,
        ],
        "EDR snapshot operation failed and failure state could not be recorded",
        {
          cause: error,
        },
      );
    }

    throw error;
  }
}
