import { db } from "../src/db.js";

const sql = db();
const verifyOnly = process.argv.includes("--verify-only");

async function verify() {
  const rows = await sql`
    SELECT
      (
        SELECT count(*)::int
        FROM identity_observations
      ) AS observations,

      (
        SELECT count(*)::int
        FROM identity_observations
        WHERE resolution_status = 'matched'
      ) AS matched,

      (
        SELECT count(*)::int
        FROM identity_observations
        WHERE resolution_status = 'ambiguous'
      ) AS ambiguous,

      (
        SELECT count(*)::int
        FROM identity_observations
        WHERE resolution_status = 'unmatched'
      ) AS unmatched,

      (
        SELECT count(*)::int
        FROM identity_observations
        WHERE resolution_status = 'conflict'
      ) AS conflicts,

      (
        SELECT count(*)::int
        FROM entity_identifiers
        WHERE source_document_id IS NOT NULL
      ) AS identifiers_with_source
  `;

  console.log("\n=== IDENTITY OBSERVATIONS STATUS ===");
  console.table(rows);
}

if (verifyOnly) {
  await verify();
  process.exit(0);
}

console.log("Starting identity-observation migration...");

await sql`
  CREATE TABLE IF NOT EXISTS identity_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    fingerprint text NOT NULL UNIQUE,

    source_document_id uuid
      REFERENCES source_documents(id)
      ON DELETE SET NULL,

    observed_entity_type text NOT NULL DEFAULT 'person',

    observed_name text,
    observed_position text,
    observed_organization text,
    observed_city text,

    observed_identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
    observed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

    resolution_status text NOT NULL DEFAULT 'pending'
      CHECK (
        resolution_status IN (
          'pending',
          'matched',
          'ambiguous',
          'unmatched',
          'conflict'
        )
      ),

    resolved_entity_id uuid
      REFERENCES entities(id)
      ON DELETE SET NULL,

    resolution_score integer
      CHECK (
        resolution_score IS NULL
        OR resolution_score BETWEEN 0 AND 100
      ),

    resolution_level text,

    resolution_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,

    resolver_version text NOT NULL DEFAULT 'er-v2',

    details jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ identity_observations");

await sql`
  ALTER TABLE entity_identifiers
  ADD COLUMN IF NOT EXISTS source_document_id uuid
`;

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'entity_identifiers_source_document_id_fkey'
    ) THEN
      ALTER TABLE entity_identifiers
      ADD CONSTRAINT entity_identifiers_source_document_id_fkey
      FOREIGN KEY (source_document_id)
      REFERENCES source_documents(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$
`;

console.log("✓ identifier provenance");

/*
 * Stable identifiers must not belong to two different entities.
 * Full names and aliases are intentionally NOT unique.
 */
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS entity_identifiers_hard_identifier_uq
  ON entity_identifiers (
    identifier_type,
    normalized_value
  )
  WHERE
    normalized_value IS NOT NULL
    AND identifier_type IN (
      'subject_id',
      'guid',
      'person_guid',
      'nazk_guid',
      'external_guid',
      'declarant_guid',
      'opendatabot_person_id'
    )
`;

await sql`
  CREATE INDEX IF NOT EXISTS identity_observations_source_idx
  ON identity_observations (source_document_id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS identity_observations_entity_idx
  ON identity_observations (resolved_entity_id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS identity_observations_status_idx
  ON identity_observations (resolution_status, created_at DESC)
`;

await sql`
  CREATE INDEX IF NOT EXISTS entity_identifiers_source_document_idx
  ON entity_identifiers (source_document_id)
`;

console.log("✓ indexes");

await verify();

console.log("\nIdentity-observation migration completed.");
