import {
  db,
} from "../src/db.js";


const sql = db();

const verifyOnly =
  process.argv.includes(
    "--verify-only",
  );


async function verify() {
  const relationRows =
    await sql`
      SELECT
        to_regclass(
          'public.dossier_versions'
        ) IS NOT NULL
          AS dossier_versions_exists
    `;

  const exists =
    relationRows[0]
      ?.dossier_versions_exists ===
    true;

  const countRows =
    exists
      ? await sql`
          SELECT
            count(*)::int
              AS dossier_versions
          FROM dossier_versions
        `
      : [{
          dossier_versions: 0,
        }];

  console.log(
    "\\n=== DOSSIER SCHEMA STATUS ===",
  );

  console.table([{
    dossier_versions_exists:
      exists,

    dossier_versions:
      countRows[0]
        ?.dossier_versions ??
      0,
  }]);
}

if (verifyOnly) {
  await verify();
  process.exit(0);
}


console.log(
  "Starting dossier schema migration...",
);


/* ============================================================
   1. DOSSIER VERSIONS

   Immutable canonical report snapshots.

   This table records what Person Monitor knew at a specific
   dossier generation time.

   Manual review tasks are intentionally NOT stored here.
   They will reference dossier_versions in a separate layer.

   report_id inside the report payload is intentionally not
   mutated by this migration/storage contract.

   ON DELETE CASCADE is intentional: explicit subject deletion
   removes its persisted dossier snapshots together with the
   subject, matching the existing hard-delete product semantics.

   report_payload_hash is an integrity hash of the exact
   canonical report payload. Its serialization/hash producer
   is implemented separately in the store layer.
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS dossier_versions (
    id uuid
      PRIMARY KEY
      DEFAULT gen_random_uuid(),

    subject_id uuid
      NOT NULL
      REFERENCES subjects(id)
      ON DELETE CASCADE,

    dossier_status text
      NOT NULL
      CHECK (
        dossier_status IN (
          'completed',
          'partial'
        )
      ),

    orchestrator_version text
      NOT NULL,

    report_schema_version text
      NOT NULL,

    report_generated_at timestamptz
      NOT NULL,

    report_payload jsonb
      NOT NULL,

    report_payload_hash text
      NOT NULL
      CHECK (
        report_payload_hash ~
          '^[0-9a-f]{64}$'
      ),

    report_payload_hash_version text
      NOT NULL,

    metadata jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    created_at timestamptz
      NOT NULL
      DEFAULT now()
  )
`;

console.log(
  "✓ dossier_versions",
);


/* ============================================================
   2. INDEXES
   ============================================================ */

await sql`
  CREATE INDEX IF NOT EXISTS
    dossier_versions_subject_created_idx
  ON dossier_versions (
    subject_id,
    created_at DESC
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS
    dossier_versions_report_generated_idx
  ON dossier_versions (
    report_generated_at DESC
  )
`;

console.log(
  "✓ dossier version indexes",
);


await verify();

console.log(
  "\\nDossier schema migration completed successfully.",
);
