import { db } from "../src/db.js";

import {
  extractNazkFacts,
} from "../src/nazk-fact-extractor.js";

const sql = db();

const dryRun =
  process.argv.includes("--dry-run");

const rows = await sql`
  SELECT
    sd.id AS source_document_id,

    sd.metadata
      ->> 'document_guid'
      AS document_guid,

    sd.raw_payload
      -> 'nazk_document'
      AS payload,

    m.entity_id

  FROM source_documents sd

  JOIN mentions m
    ON m.source_document_id =
       sd.id

  WHERE
    m.provider =
      'nazk-declarations'

    AND m.entity_id
      IS NOT NULL

    AND sd.raw_payload
      ? 'nazk_document'

  ORDER BY
    sd.created_at ASC
`;

const stats = {
  documents: 0,
  extracted: 0,
  inserted: 0,

  employment: 0,
  family_member: 0,
  real_estate: 0,
  vehicle: 0,
  income: 0,
  cash_asset: 0,

  errors: 0,
};

for (const row of rows) {
  stats.documents += 1;

  try {
    const facts =
      extractNazkFacts(
        row.payload,
        {
          documentGuid:
            row.document_guid,
        },
      );

    stats.extracted +=
      facts.length;

    for (const fact of facts) {
      if (
        Object.hasOwn(
          stats,
          fact.factType,
        )
      ) {
        stats[
          fact.factType
        ] += 1;
      }

      if (dryRun) {
        continue;
      }

      const result = await sql`
        INSERT INTO facts (
          entity_id,
          fact_type,
          value_text,
          value_number,
          value_json,
          unit,
          source_document_id,
          confidence,
          verification_status,
          metadata,
          fact_key
        )
        VALUES (
          ${row.entity_id},
          ${fact.factType},
          ${fact.valueText},
          ${fact.valueNumber},
          ${JSON.stringify(
            fact.valueJson,
          )}::jsonb,
          ${fact.unit},
          ${row.source_document_id},
          100,
          'source_extracted',
          ${JSON.stringify(
            fact.metadata,
          )}::jsonb,
          ${fact.factKey}
        )

        ON CONFLICT
        DO NOTHING

        RETURNING id
      `;

      if (result.length) {
        stats.inserted += 1;
      }
    }
  } catch (error) {
    stats.errors += 1;

    console.error(
      `Document ${row.source_document_id}:`,
      error.message,
    );
  }
}

console.log(
  dryRun
    ? "\n=== NACP FACT EXTRACTION DRY RUN ==="
    : "\n=== NACP FACT EXTRACTION ===",
);

console.table([stats]);

if (stats.errors) {
  process.exitCode = 1;
}
