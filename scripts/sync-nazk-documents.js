import { db } from "../src/db.js";

import {
  fetchNazkDocument,
} from "../src/nazk-api.js";

const sql = db();

const dryRun =
  process.argv.includes("--dry-run");

const limitArg =
  process.argv.find((arg) =>
    arg.startsWith("--limit="),
  );

const limit = Math.max(
  1,
  Math.min(
    Number(
      limitArg?.split("=")[1] ??
      1000,
    ) || 1000,
    1000,
  ),
);

const rows = await sql`
  SELECT
    sd.id,
    sd.url,
    sd.content_hash,

    (
      COALESCE(
        sd.raw_payload,
        '{}'::jsonb
      )
      ? 'nazk_document'
    ) AS has_nazk_document

  FROM source_documents sd

  JOIN mentions m
    ON m.source_document_id =
       sd.id

  WHERE m.provider =
    'nazk-declarations'

  ORDER BY m.first_seen_at ASC

  LIMIT ${limit}
`;

const stats = {
  documents: rows.length,
  fetched: 0,
  updated: 0,
  unchanged: 0,
  errors: 0,
  bytes: 0,
};

for (const row of rows) {
  try {
    const result =
      await fetchNazkDocument(
        row.url,
      );

    stats.fetched += 1;
    stats.bytes += result.bytes;

    if (
      row.has_nazk_document &&
      row.content_hash ===
        result.contentHash
    ) {
      stats.unchanged += 1;
      continue;
    }

    if (dryRun) {
      continue;
    }

    const syncMetadata = {
      version: "v2",
      status: "ok",
      synchronized_at:
        new Date().toISOString(),
      bytes: result.bytes,
    };

    await sql`
      UPDATE source_documents

      SET
        raw_payload =
          COALESCE(
            raw_payload,
            '{}'::jsonb
          )
          ||
          jsonb_build_object(
            'nazk_document',
            ${JSON.stringify(
              result.payload,
            )}::jsonb
          ),

        content_hash =
          ${result.contentHash},

        fetched_at = now(),

        metadata =
          COALESCE(
            metadata,
            '{}'::jsonb
          )
          ||
          jsonb_build_object(
            'nazk_api',
            ${JSON.stringify(
              syncMetadata,
            )}::jsonb
          )

      WHERE id = ${row.id}
    `;

    stats.updated += 1;

    /*
     * Gentle sequential load on public API.
     */
    await new Promise((resolve) =>
      setTimeout(resolve, 150),
    );
  } catch (error) {
    stats.errors += 1;

    console.error(
      `Document ${row.id}:`,
      error.message,
    );
  }
}

console.log(
  dryRun
    ? "\n=== NACP API DRY RUN ==="
    : "\n=== NACP API SYNC ===",
);

console.table([stats]);

if (stats.errors > 0) {
  process.exitCode = 1;
}
