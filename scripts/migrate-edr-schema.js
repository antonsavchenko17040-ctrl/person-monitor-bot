import {
  db,
} from "../src/db.js";

const sql = db();

const verifyOnly =
  process.argv.includes(
    "--verify-only",
  );

async function verify() {
  const rows =
    await sql`
      SELECT
        (
          SELECT count(*)::int
          FROM edr_snapshots
        ) AS snapshots,

        (
          SELECT count(*)::int
          FROM edr_snapshot_resources
        ) AS resources,

        (
          SELECT count(*)::int
          FROM edr_records
        ) AS records,

        (
          SELECT count(*)::int
          FROM edr_relation_observations
        ) AS relations,

        (
          SELECT count(*)::int
          FROM edr_active_snapshot
        ) AS active_pointers,

        (
          SELECT count(*)::int
          FROM edr_snapshots
          WHERE status = 'staging'
        ) AS staging_snapshots,

        (
          SELECT count(*)::int
          FROM edr_snapshots
          WHERE status = 'ready'
        ) AS ready_snapshots,

        (
          SELECT count(*)::int
          FROM edr_snapshots
          WHERE status = 'failed'
        ) AS failed_snapshots
    `;

  console.log(
    "\n=== EDR SCHEMA STATUS ===",
  );

  console.table(
    rows,
  );
}

if (verifyOnly) {
  await verify();
  process.exit(0);
}

console.log(
  "Starting EDR schema migration...",
);

/* ============================================================
   1. SNAPSHOTS

   Snapshot lifecycle:
   staging -> ready
           -> failed

   Active state is intentionally NOT stored here.
   edr_active_snapshot is the single source of truth.
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS edr_snapshots (
    id uuid
      PRIMARY KEY
      DEFAULT gen_random_uuid(),

    version_key text
      NOT NULL
      UNIQUE,

    schema_version text
      NOT NULL,

    status text
      NOT NULL
      DEFAULT 'staging'
      CHECK (
        status IN (
          'staging',
          'ready',
          'failed'
        )
      ),

    discovered_at timestamptz,

    started_at timestamptz
      NOT NULL
      DEFAULT now(),

    completed_at timestamptz,

    failed_at timestamptz,

    organization_count bigint
      NOT NULL
      DEFAULT 0
      CHECK (
        organization_count >= 0
      ),

    fop_count bigint
      NOT NULL
      DEFAULT 0
      CHECK (
        fop_count >= 0
      ),

    relation_count bigint
      NOT NULL
      DEFAULT 0
      CHECK (
        relation_count >= 0
      ),

    error_text text,

    metadata jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    created_at timestamptz
      NOT NULL
      DEFAULT now(),

    updated_at timestamptz
      NOT NULL
      DEFAULT now()
  )
`;

console.log(
  "✓ edr_snapshots",
);

/* ============================================================
   2. SNAPSHOT RESOURCES

   One UO and one FOP archive per snapshot.
   Keeps official CKAN metadata + locally calculated SHA-256.
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS edr_snapshot_resources (
    id uuid
      PRIMARY KEY
      DEFAULT gen_random_uuid(),

    snapshot_id uuid
      NOT NULL
      REFERENCES edr_snapshots(id)
      ON DELETE CASCADE,

    resource_type text
      NOT NULL
      CHECK (
        resource_type IN (
          'organization',
          'fop'
        )
      ),

    resource_name text
      NOT NULL,

    resource_id text
      NOT NULL,

    source_url text
      NOT NULL,

    source_last_modified timestamptz,

    expected_size bigint
      CHECK (
        expected_size IS NULL
        OR expected_size >= 0
      ),

    downloaded_size bigint
      CHECK (
        downloaded_size IS NULL
        OR downloaded_size >= 0
      ),

    sha256 text,

    imported_count bigint
      NOT NULL
      DEFAULT 0
      CHECK (
        imported_count >= 0
      ),

    metadata jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    created_at timestamptz
      NOT NULL
      DEFAULT now(),

    updated_at timestamptz
      NOT NULL
      DEFAULT now(),

    UNIQUE (
      snapshot_id,
      resource_type
    )
  )
`;

console.log(
  "✓ edr_snapshot_resources",
);

/* ============================================================
   3. NORMALIZED EDR RECORDS

   No uniqueness assumption is made about RECORD.
   We have not verified that the official RECORD field is globally
   unique and must not invent that guarantee.

   content_hash will later support B2.10 OLD <-> NEW comparison.
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS edr_records (
    id bigserial
      PRIMARY KEY,

    snapshot_id uuid
      NOT NULL
      REFERENCES edr_snapshots(id)
      ON DELETE CASCADE,

    record_type text
      NOT NULL
      CHECK (
        record_type IN (
          'organization',
          'fop'
        )
      ),

    record_number text
      NOT NULL,

    source_sequence bigint
      NOT NULL,

    name text,

    normalized_name text,

    short_name text,

    edrpou text,

    status text,

    legal_form text,

    registration text,

    farmer text,

    estate_manager text,

    content_hash text
      NOT NULL,

    details jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    created_at timestamptz
      NOT NULL
      DEFAULT now()
  )
`;

console.log(
  "✓ edr_records",
);

/* Existing installations may already have edr_records from an
   earlier additive migration. Backfill source_sequence before
   enforcing the importer invariant. */

await sql`
  ALTER TABLE edr_records
  ADD COLUMN IF NOT EXISTS
    source_sequence bigint
`;

await sql`
  UPDATE edr_records
  SET source_sequence = id
  WHERE source_sequence IS NULL
`;

await sql`
  ALTER TABLE edr_records
  ALTER COLUMN source_sequence
  SET NOT NULL
`;

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname =
        'edr_records_source_sequence_nonnegative'
    ) THEN
      ALTER TABLE edr_records
      ADD CONSTRAINT
        edr_records_source_sequence_nonnegative
      CHECK (
        source_sequence >= 0
      );
    END IF;
  END
  $$
`;

console.log(
  "✓ edr_records source sequence",
);

/* ============================================================
   4. RELATION OBSERVATIONS

   Raw normalized relation strings remain observations here.
   Person/company resolution is deliberately postponed to B2.7.
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS edr_relation_observations (
    id bigserial
      PRIMARY KEY,

    snapshot_id uuid
      NOT NULL
      REFERENCES edr_snapshots(id)
      ON DELETE CASCADE,

    record_id bigint
      NOT NULL
      REFERENCES edr_records(id)
      ON DELETE CASCADE,

    relation_type text
      NOT NULL,

    ordinal integer
      NOT NULL
      DEFAULT 0
      CHECK (
        ordinal >= 0
      ),

    value_text text,

    normalized_value text,

    value_code text,

    metadata jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    created_at timestamptz
      NOT NULL
      DEFAULT now(),

    CHECK (
      value_text IS NOT NULL
      OR value_code IS NOT NULL
    )
  )
`;

console.log(
  "✓ edr_relation_observations",
);

/* ============================================================
   5. ACTIVE SNAPSHOT POINTER

   Exactly zero or one row exists here.
   Switching snapshot later requires only one atomic UPSERT.

   Old EDR data is never modified during staging import.
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS edr_active_snapshot (
    singleton boolean
      PRIMARY KEY
      DEFAULT true
      CHECK (singleton),

    snapshot_id uuid
      NOT NULL
      REFERENCES edr_snapshots(id)
      ON DELETE RESTRICT,

    activated_at timestamptz
      NOT NULL
      DEFAULT now()
  )
`;

console.log(
  "✓ edr_active_snapshot",
);

/* ============================================================
   6. INDEXES
   ============================================================ */

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_snapshots_status_idx
  ON edr_snapshots (
    status,
    created_at DESC
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_records_snapshot_type_idx
  ON edr_records (
    snapshot_id,
    record_type
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS
    edr_records_snapshot_sequence_uidx
  ON edr_records (
    snapshot_id,
    source_sequence
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_records_name_idx
  ON edr_records (
    snapshot_id,
    normalized_name
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_records_edrpou_idx
  ON edr_records (
    snapshot_id,
    edrpou
  )
  WHERE edrpou IS NOT NULL
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_records_hash_idx
  ON edr_records (
    snapshot_id,
    content_hash
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_relations_record_idx
  ON edr_relation_observations (
    record_id
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS
    edr_relations_snapshot_record_type_ordinal_uidx
  ON edr_relation_observations (
    snapshot_id,
    record_id,
    relation_type,
    ordinal
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_relations_lookup_idx
  ON edr_relation_observations (
    snapshot_id,
    relation_type,
    normalized_value
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    edr_relations_code_idx
  ON edr_relation_observations (
    snapshot_id,
    value_code
  )
  WHERE value_code IS NOT NULL
`;

console.log(
  "✓ EDR indexes",
);

await verify();

console.log(
  "\nEDR schema migration completed.",
);
