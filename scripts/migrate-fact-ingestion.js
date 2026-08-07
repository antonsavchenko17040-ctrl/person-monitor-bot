import { db } from "../src/db.js";

const sql = db();
const verifyOnly = process.argv.includes("--verify-only");

async function verify() {
  const rows = await sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'facts'
          AND column_name = 'fact_key'
      ) AS has_fact_key,

      (
        SELECT count(*)::int
        FROM facts
      ) AS facts,

      (
        SELECT count(*)::int
        FROM facts
        WHERE fact_key IS NOT NULL
      ) AS keyed_facts,

      (
        SELECT count(*)::int
        FROM facts
        WHERE fact_type = 'declaration_submission'
      ) AS declaration_facts
  `;

  console.log("\n=== FACT INGESTION STATUS ===");
  console.table(rows);
}

if (verifyOnly) {
  await verify();
  process.exit(0);
}

await sql`
  ALTER TABLE facts
  ADD COLUMN IF NOT EXISTS fact_key text
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS facts_fact_key_uq
  ON facts (fact_key)
  WHERE fact_key IS NOT NULL
`;

await sql`
  CREATE INDEX IF NOT EXISTS facts_source_document_idx
  ON facts (source_document_id)
`;

console.log("✓ facts.fact_key");
console.log("✓ ingestion indexes");

await verify();
