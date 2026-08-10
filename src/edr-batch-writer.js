export const EDR_MAX_BATCH_RECORDS = 1000;

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

function requireArray(
  value,
  field,
) {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `${field} must be an array`,
    );
  }

  return value;
}

function uniqueSourceSequences(
  records,
) {
  const seen =
    new Set();

  for (
    const record of records
  ) {
    const sequence =
      Number(
        record?.source_sequence,
      );

    if (
      !Number.isSafeInteger(
        sequence,
      ) ||
      sequence < 0
    ) {
      throw new TypeError(
        "record source_sequence must be a non-negative safe integer",
      );
    }

    if (
      seen.has(
        sequence,
      )
    ) {
      throw new TypeError(
        "record source_sequence must be unique within batch",
      );
    }

    seen.add(
      sequence,
    );
  }

  return seen;
}

function validateRelations(
  relations,
  sequences,
) {
  for (
    const relation of relations
  ) {
    const sequence =
      Number(
        relation?.source_sequence,
      );

    if (
      !Number.isSafeInteger(
        sequence,
      ) ||
      !sequences.has(
        sequence,
      )
    ) {
      throw new TypeError(
        "relation source_sequence must reference a record in the same batch",
      );
    }
  }
}

export async function
writeEdrImportBatch(
  sql,
  {
    snapshotId,
    records,
    relations = [],
  } = {},
) {
  requireSql(sql);

  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const recordRows =
    requireArray(
      records,
      "records",
    );

  const relationRows =
    requireArray(
      relations,
      "relations",
    );

  if (
    recordRows.length === 0
  ) {
    throw new TypeError(
      "records must not be empty",
    );
  }

  if (
    recordRows.length >
      EDR_MAX_BATCH_RECORDS
  ) {
    throw new RangeError(
      `records exceed maximum batch size of ${EDR_MAX_BATCH_RECORDS}`,
    );
  }

  const sequences =
    uniqueSourceSequences(
      recordRows,
    );

  validateRelations(
    relationRows,
    sequences,
  );

  const recordsJson =
    JSON.stringify(
      recordRows,
    );

  const relationsJson =
    JSON.stringify(
      relationRows,
    );

  const rows =
    await sql`
      WITH candidate_snapshot AS (
        SELECT id
        FROM edr_snapshots
        WHERE id =
          ${normalizedSnapshotId}
          AND status =
            'staging'
      ),

      input_records AS (
        SELECT *
        FROM jsonb_to_recordset(
          ${recordsJson}::jsonb
        ) AS x (
          source_sequence bigint,
          record_type text,
          record_number text,
          name text,
          normalized_name text,
          short_name text,
          edrpou text,
          status text,
          legal_form text,
          registration text,
          farmer text,
          estate_manager text,
          content_hash text,
          details jsonb
        )
      ),

      upserted_records AS (
        INSERT INTO edr_records (
          snapshot_id,
          source_sequence,
          record_type,
          record_number,
          name,
          normalized_name,
          short_name,
          edrpou,
          status,
          legal_form,
          registration,
          farmer,
          estate_manager,
          content_hash,
          details
        )

        SELECT
          candidate_snapshot.id,
          input_records.source_sequence,
          input_records.record_type,
          input_records.record_number,
          input_records.name,
          input_records.normalized_name,
          input_records.short_name,
          input_records.edrpou,
          input_records.status,
          input_records.legal_form,
          input_records.registration,
          input_records.farmer,
          input_records.estate_manager,
          input_records.content_hash,
          COALESCE(
            input_records.details,
            '{}'::jsonb
          )

        FROM input_records
        CROSS JOIN candidate_snapshot

        ON CONFLICT (
          snapshot_id,
          source_sequence
        )
        DO UPDATE SET
          record_type =
            EXCLUDED.record_type,

          record_number =
            EXCLUDED.record_number,

          name =
            EXCLUDED.name,

          normalized_name =
            EXCLUDED.normalized_name,

          short_name =
            EXCLUDED.short_name,

          edrpou =
            EXCLUDED.edrpou,

          status =
            EXCLUDED.status,

          legal_form =
            EXCLUDED.legal_form,

          registration =
            EXCLUDED.registration,

          farmer =
            EXCLUDED.farmer,

          estate_manager =
            EXCLUDED.estate_manager,

          content_hash =
            EXCLUDED.content_hash,

          details =
            EXCLUDED.details

        RETURNING
          id,
          source_sequence
      ),

      input_relations AS (
        SELECT *
        FROM jsonb_to_recordset(
          ${relationsJson}::jsonb
        ) AS x (
          source_sequence bigint,
          relation_type text,
          ordinal integer,
          value_text text,
          normalized_value text,
          value_code text,
          metadata jsonb
        )
      ),

      upserted_relations AS (
        INSERT INTO
          edr_relation_observations (
            snapshot_id,
            record_id,
            relation_type,
            ordinal,
            value_text,
            normalized_value,
            value_code,
            metadata
          )

        SELECT
          candidate_snapshot.id,
          upserted_records.id,
          input_relations.relation_type,
          input_relations.ordinal,
          input_relations.value_text,
          input_relations.normalized_value,
          input_relations.value_code,
          COALESCE(
            input_relations.metadata,
            '{}'::jsonb
          )

        FROM input_relations

        JOIN upserted_records
          ON upserted_records.source_sequence =
            input_relations.source_sequence

        CROSS JOIN candidate_snapshot

        ON CONFLICT (
          snapshot_id,
          record_id,
          relation_type,
          ordinal
        )
        DO UPDATE SET
          value_text =
            EXCLUDED.value_text,

          normalized_value =
            EXCLUDED.normalized_value,

          value_code =
            EXCLUDED.value_code,

          metadata =
            EXCLUDED.metadata

        RETURNING id
      )

      SELECT
        EXISTS(
          SELECT 1
          FROM candidate_snapshot
        ) AS candidate_exists,

        (
          SELECT count(*)::int
          FROM upserted_records
        ) AS records_written,

        (
          SELECT count(*)::int
          FROM upserted_relations
        ) AS relations_written
    `;

  const result =
    rows[0];

  if (
    !result?.candidate_exists
  ) {
    throw new Error(
      "EDR snapshot is not staging or does not exist",
    );
  }

  return {
    records_written:
      Number(
        result.records_written ??
          0,
      ),

    relations_written:
      Number(
        result.relations_written ??
          0,
      ),
  };
}
