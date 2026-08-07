import { db } from "../src/db.js";

const sql = db();
const verifyOnly = process.argv.includes("--verify-only");

async function verify() {
  const rows = await sql`
    SELECT
      (SELECT count(*)::int FROM subjects) AS subjects,
      (SELECT count(*)::int FROM mentions) AS mentions,

      (
        SELECT count(*)::int
        FROM entities
      ) AS entities,

      (
        SELECT count(*)::int
        FROM entity_identifiers
      ) AS entity_identifiers,

      (
        SELECT count(*)::int
        FROM facts
      ) AS facts,

      (
        SELECT count(*)::int
        FROM relations
      ) AS relations,

      (
        SELECT count(*)::int
        FROM source_documents
      ) AS source_documents,

      (
        SELECT count(*)::int
        FROM cross_checks
      ) AS cross_checks,

      (
        SELECT count(*)::int
        FROM subjects
        WHERE entity_id IS NOT NULL
      ) AS subjects_linked,

      (
        SELECT count(*)::int
        FROM mentions
        WHERE entity_id IS NOT NULL
      ) AS mentions_entity_linked,

      (
        SELECT count(*)::int
        FROM mentions
        WHERE source_document_id IS NOT NULL
      ) AS mentions_document_linked
  `;

  console.log("\n=== ANALYTICS SCHEMA STATUS ===");
  console.table(rows);
}

if (verifyOnly) {
  await verify();
  process.exit(0);
}

console.log("Starting additive analytics migration...");

/* ============================================================
   1. ENTITIES
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type text NOT NULL,
    canonical_name text NOT NULL,
    normalized_name text,

    status text NOT NULL DEFAULT 'active',

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ entities");

/* ============================================================
   2. ENTITY IDENTIFIERS
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS entity_identifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_id uuid NOT NULL
      REFERENCES entities(id)
      ON DELETE CASCADE,

    identifier_type text NOT NULL,
    identifier_value text NOT NULL,
    normalized_value text,

    source text,

    confidence integer NOT NULL DEFAULT 100
      CHECK (confidence BETWEEN 0 AND 100),

    is_primary boolean NOT NULL DEFAULT false,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ entity_identifiers");

/* ============================================================
   3. SOURCE DOCUMENTS
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS source_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    source_type text NOT NULL,
    source_name text,

    external_id text,

    url text,
    title text,

    published_at timestamptz,
    fetched_at timestamptz NOT NULL DEFAULT now(),

    content_hash text,

    raw_payload jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (source_type, external_id)
  )
`;

console.log("✓ source_documents");

/* ============================================================
   4. FACTS
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS facts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_id uuid NOT NULL
      REFERENCES entities(id)
      ON DELETE CASCADE,

    fact_type text NOT NULL,

    value_text text,
    value_number numeric,
    value_date date,
    value_json jsonb,

    unit text,

    source_document_id uuid
      REFERENCES source_documents(id)
      ON DELETE SET NULL,

    valid_from date,
    valid_to date,

    confidence integer NOT NULL DEFAULT 100
      CHECK (confidence BETWEEN 0 AND 100),

    verification_status text NOT NULL DEFAULT 'unverified',

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ facts");

/* ============================================================
   5. RELATIONS
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    from_entity_id uuid NOT NULL
      REFERENCES entities(id),

    to_entity_id uuid NOT NULL
      REFERENCES entities(id),

    relation_type text NOT NULL,

    source_document_id uuid
      REFERENCES source_documents(id)
      ON DELETE SET NULL,

    valid_from date,
    valid_to date,

    confidence integer NOT NULL DEFAULT 100
      CHECK (confidence BETWEEN 0 AND 100),

    verification_status text NOT NULL DEFAULT 'unverified',

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ relations");

/* ============================================================
   6. CROSS CHECKS
   ============================================================ */

await sql`
  CREATE TABLE IF NOT EXISTS cross_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_id uuid
      REFERENCES entities(id)
      ON DELETE CASCADE,

    check_type text NOT NULL,
    rule_code text,

    left_fact_id uuid
      REFERENCES facts(id)
      ON DELETE SET NULL,

    right_fact_id uuid
      REFERENCES facts(id)
      ON DELETE SET NULL,

    left_source_document_id uuid
      REFERENCES source_documents(id)
      ON DELETE SET NULL,

    right_source_document_id uuid
      REFERENCES source_documents(id)
      ON DELETE SET NULL,

    result text NOT NULL,

    score integer
      CHECK (score IS NULL OR score BETWEEN 0 AND 100),

    details jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ cross_checks");

/* ============================================================
   7. INDEXES
   ============================================================ */

await sql`
  CREATE INDEX IF NOT EXISTS entities_type_idx
  ON entities (entity_type)
`;

await sql`
  CREATE INDEX IF NOT EXISTS entities_normalized_name_idx
  ON entities (normalized_name)
`;

await sql`
  CREATE INDEX IF NOT EXISTS entity_identifiers_entity_idx
  ON entity_identifiers (entity_id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS entity_identifiers_lookup_idx
  ON entity_identifiers (identifier_type, normalized_value)
`;

await sql`
  CREATE INDEX IF NOT EXISTS facts_entity_type_idx
  ON facts (entity_id, fact_type)
`;

await sql`
  CREATE INDEX IF NOT EXISTS relations_from_idx
  ON relations (from_entity_id, relation_type)
`;

await sql`
  CREATE INDEX IF NOT EXISTS relations_to_idx
  ON relations (to_entity_id, relation_type)
`;

await sql`
  CREATE INDEX IF NOT EXISTS cross_checks_entity_idx
  ON cross_checks (entity_id)
`;

console.log("✓ indexes");

/* ============================================================
   8. ADDITIVE COLUMNS IN LEGACY TABLES
   ============================================================ */

await sql`
  ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS entity_id uuid
`;

await sql`
  ALTER TABLE mentions
  ADD COLUMN IF NOT EXISTS entity_id uuid
`;

await sql`
  ALTER TABLE mentions
  ADD COLUMN IF NOT EXISTS source_document_id uuid
`;

console.log("✓ legacy link columns");

/* ============================================================
   9. FOREIGN KEYS FOR LEGACY TABLES
   ============================================================ */

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'subjects_entity_id_fkey'
    ) THEN
      ALTER TABLE subjects
      ADD CONSTRAINT subjects_entity_id_fkey
      FOREIGN KEY (entity_id)
      REFERENCES entities(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$
`;

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'mentions_entity_id_fkey'
    ) THEN
      ALTER TABLE mentions
      ADD CONSTRAINT mentions_entity_id_fkey
      FOREIGN KEY (entity_id)
      REFERENCES entities(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$
`;

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'mentions_source_document_id_fkey'
    ) THEN
      ALTER TABLE mentions
      ADD CONSTRAINT mentions_source_document_id_fkey
      FOREIGN KEY (source_document_id)
      REFERENCES source_documents(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$
`;

console.log("✓ legacy foreign keys");

/* ============================================================
   10. SUBJECTS -> ENTITIES
   Entity UUID intentionally equals legacy subject UUID.
   This gives us a deterministic, reversible 1:1 migration.
   ============================================================ */

await sql`
  INSERT INTO entities (
    id,
    entity_type,
    canonical_name,
    normalized_name,
    status,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    s.id,
    'person',
    s.full_name,
    lower(
      trim(
        regexp_replace(s.full_name, '\s+', ' ', 'g')
      )
    ),
    CASE
      WHEN s.enabled THEN 'active'
      ELSE 'inactive'
    END,
    jsonb_strip_nulls(
      jsonb_build_object(
        'legacy_subject_id', s.id::text,
        'organization', s.organization,
        'position', s.position,
        'city', s.city
      )
    ),
    s.created_at,
    now()
  FROM subjects s
  ON CONFLICT (id) DO NOTHING
`;

await sql`
  UPDATE subjects
  SET entity_id = id
  WHERE entity_id IS NULL
`;

console.log("✓ subjects -> entities");

/* ============================================================
   11. LEGACY SUBJECT ID IDENTIFIERS
   ============================================================ */

await sql`
  INSERT INTO entity_identifiers (
    entity_id,
    identifier_type,
    identifier_value,
    normalized_value,
    source,
    confidence,
    is_primary,
    metadata
  )
  SELECT
    s.entity_id,
    'subject_id',
    s.id::text,
    s.id::text,
    'subjects',
    100,
    true,
    jsonb_build_object(
      'legacy_subject_id',
      s.id::text
    )
  FROM subjects s
  WHERE s.entity_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM entity_identifiers ei
      WHERE ei.entity_id = s.entity_id
        AND ei.identifier_type = 'subject_id'
        AND ei.identifier_value = s.id::text
        AND ei.source = 'subjects'
    )
`;

console.log("✓ subject identifiers");

/* ============================================================
   12. FULL NAME IDENTIFIERS
   ============================================================ */

await sql`
  INSERT INTO entity_identifiers (
    entity_id,
    identifier_type,
    identifier_value,
    normalized_value,
    source,
    confidence,
    is_primary,
    metadata
  )
  SELECT
    s.entity_id,
    'full_name',
    s.full_name,
    lower(
      trim(
        regexp_replace(s.full_name, '\s+', ' ', 'g')
      )
    ),
    'subjects',
    100,
    true,
    jsonb_build_object(
      'legacy_subject_id',
      s.id::text
    )
  FROM subjects s
  WHERE s.entity_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM entity_identifiers ei
      WHERE ei.entity_id = s.entity_id
        AND ei.identifier_type = 'full_name'
        AND ei.identifier_value = s.full_name
        AND ei.source = 'subjects'
    )
`;

console.log("✓ full-name identifiers");

/* ============================================================
   13. ALIASES -> IDENTIFIERS
   ============================================================ */

await sql`
  INSERT INTO entity_identifiers (
    entity_id,
    identifier_type,
    identifier_value,
    normalized_value,
    source,
    confidence,
    is_primary,
    metadata
  )
  SELECT
    s.entity_id,
    'alias',
    a.alias,
    lower(
      trim(
        regexp_replace(a.alias, '\s+', ' ', 'g')
      )
    ),
    'subjects',
    95,
    false,
    jsonb_build_object(
      'legacy_subject_id',
      s.id::text
    )
  FROM subjects s
  CROSS JOIN LATERAL
    jsonb_array_elements_text(
      COALESCE(s.aliases, '[]'::jsonb)
    ) AS a(alias)
  WHERE s.entity_id IS NOT NULL
    AND trim(a.alias) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM entity_identifiers ei
      WHERE ei.entity_id = s.entity_id
        AND ei.identifier_type = 'alias'
        AND ei.identifier_value = a.alias
        AND ei.source = 'subjects'
    )
`;

console.log("✓ aliases -> identifiers");

/* ============================================================
   14. PROFILE FIELDS -> FACTS
   ============================================================ */

await sql`
  INSERT INTO facts (
    entity_id,
    fact_type,
    value_text,
    confidence,
    verification_status,
    metadata
  )
  SELECT
    s.entity_id,
    v.fact_type,
    v.fact_value,
    100,
    'legacy_subject',
    jsonb_build_object(
      'legacy_subject_id',
      s.id::text
    )
  FROM subjects s
  CROSS JOIN LATERAL (
    VALUES
      ('organization', s.organization),
      ('position', s.position),
      ('city', s.city)
  ) AS v(fact_type, fact_value)
  WHERE s.entity_id IS NOT NULL
    AND NULLIF(trim(v.fact_value), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM facts f
      WHERE f.entity_id = s.entity_id
        AND f.fact_type = v.fact_type
        AND f.value_text = v.fact_value
        AND f.metadata ->> 'legacy_subject_id' = s.id::text
    )
`;

console.log("✓ subject profile -> facts");

/* ============================================================
   15. MENTIONS -> SOURCE DOCUMENTS
   Original mention stays untouched.
   ============================================================ */

await sql`
  INSERT INTO source_documents (
    source_type,
    source_name,
    external_id,
    url,
    title,
    raw_payload,
    metadata,
    created_at
  )
  SELECT
    'mention',
    COALESCE(m.source, m.provider),
    m.id::text,
    m.url,
    m.title,
    jsonb_strip_nulls(
      jsonb_build_object(
        'provider', m.provider,
        'snippet', m.snippet,
        'published_at_raw', m.published_at,
        'match_score', m.match_score,
        'match_level', m.match_level,
        'reasons', m.reasons
      )
    ),
    jsonb_build_object(
      'legacy_mention_id', m.id::text,
      'legacy_subject_id', m.subject_id::text,
      'fingerprint', m.fingerprint
    ),
    m.first_seen_at
  FROM mentions m
  ON CONFLICT (source_type, external_id)
  DO NOTHING
`;

console.log("✓ mentions -> source_documents");

/* ============================================================
   16. LINK MENTIONS TO ENTITIES + DOCUMENTS
   ============================================================ */

await sql`
  UPDATE mentions m
  SET entity_id = s.entity_id
  FROM subjects s
  WHERE m.subject_id = s.id
    AND m.entity_id IS NULL
    AND s.entity_id IS NOT NULL
`;

await sql`
  UPDATE mentions m
  SET source_document_id = sd.id
  FROM source_documents sd
  WHERE sd.source_type = 'mention'
    AND sd.external_id = m.id::text
    AND m.source_document_id IS NULL
`;

console.log("✓ mentions linked");

/* ============================================================
   17. LEGACY LINK INDEXES
   ============================================================ */

await sql`
  CREATE INDEX IF NOT EXISTS subjects_entity_id_idx
  ON subjects (entity_id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS mentions_entity_id_idx
  ON mentions (entity_id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS mentions_source_document_id_idx
  ON mentions (source_document_id)
`;

console.log("✓ legacy indexes");

await verify();

console.log("\nMigration completed successfully.");
console.log("No legacy subjects or mentions were deleted.");
