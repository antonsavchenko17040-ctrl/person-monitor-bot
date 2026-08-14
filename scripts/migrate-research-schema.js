import { db } from "../src/db.js";

const verifyOnly = process.argv.includes("--verify-only");
const sql = db();

if (!verifyOnly) {
  await sql`
    CREATE TABLE IF NOT EXISTS research_requests (
      id text PRIMARY KEY,
      input_payload jsonb NOT NULL,
      status text NOT NULL,
      identity_status text,
      resolved_subject_id text,
      candidate_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
      clarification_options jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS research_requests_updated_idx
    ON research_requests (updated_at DESC)
  `;
}

const rows = await sql`
  SELECT
    to_regclass('public.research_requests') AS research_requests,
    to_regclass('public.research_requests_updated_idx') AS updated_index
`;

if (!rows[0]?.research_requests || !rows[0]?.updated_index) {
  throw new Error("Research schema verification failed");
}

console.log("✓ research_requests");
console.log("✓ research_requests_updated_idx");
