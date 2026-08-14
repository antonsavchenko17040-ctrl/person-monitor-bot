import { db } from "./db.js";
import { newId } from "./utils.js";
import { normalizeResearchRecord } from "./research-contract.js";

let schemaPromise = null;

export async function ensureResearchSchema(sql = db()) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
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
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export async function createResearchRequest(input, options = {}) {
  const sql = options.sql ?? db();
  await ensureResearchSchema(sql);

  const id = options.id ?? newId();
  const rows = await sql`
    INSERT INTO research_requests (
      id,
      input_payload,
      status,
      identity_status
    )
    VALUES (
      ${id},
      ${JSON.stringify(input)}::jsonb,
      'created',
      'pending'
    )
    RETURNING *
  `;

  return normalizeResearchRecord(rows[0]);
}

export async function getResearchRequest(id, options = {}) {
  const sql = options.sql ?? db();
  await ensureResearchSchema(sql);

  const rows = await sql`
    SELECT *
    FROM research_requests
    WHERE id = ${id}
    LIMIT 1
  `;

  return normalizeResearchRecord(rows[0] ?? null);
}

export async function updateResearchRequest(id, patch, options = {}) {
  const sql = options.sql ?? db();
  await ensureResearchSchema(sql);

  const current = await getResearchRequest(id, { sql });

  if (!current) {
    return null;
  }

  const input = patch.input ?? current.input;
  const candidates = patch.candidates ?? current.candidates;
  const clarificationOptions =
    patch.clarificationOptions ?? current.clarificationOptions;

  const rows = await sql`
    UPDATE research_requests
    SET
      input_payload = ${JSON.stringify(input)}::jsonb,
      status = ${patch.status ?? current.status},
      identity_status = ${patch.identityStatus ?? current.identityStatus},
      resolved_subject_id = ${
        patch.resolvedSubjectId === undefined
          ? current.resolvedSubjectId
          : patch.resolvedSubjectId
      },
      candidate_payload = ${JSON.stringify(candidates)}::jsonb,
      clarification_options = ${JSON.stringify(clarificationOptions)}::jsonb,
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  return normalizeResearchRecord(rows[0] ?? null);
}
