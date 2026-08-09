import { db } from "../src/db.js";

import {
  extractNazkFacts,
} from "../src/nazk-fact-extractor.js";

const sql = db();

const dryRun =
  process.argv.includes("--dry-run");

function itemRef(item, index) {
  return String(
    item?.iteration ??
    item?.id ??
    index,
  ).trim();
}

const facts = await sql`
  SELECT
    id,
    source_document_id,
    metadata ->> 'item_ref'
      AS item_ref,
    value_json -> 'source_details'
      AS source_details

  FROM facts

  WHERE fact_type = 'income'
`;

const factIndex = new Map();

for (const fact of facts) {
  factIndex.set(
    [
      fact.source_document_id,
      fact.item_ref,
    ].join("|"),
    fact,
  );
}

const documents = await sql`
  SELECT
    id,

    metadata
      ->> 'document_guid'
      AS document_guid,

    raw_payload
      -> 'nazk_document'
      AS payload

  FROM source_documents

  WHERE
    jsonb_typeof(
      raw_payload
        -> 'nazk_document'
        -> 'data'
        -> 'step_11'
        -> 'data'
    ) = 'array'
`;

const stats = {
  documents:
    documents.length,

  rawItems: 0,
  matchedFacts: 0,
  missingFacts: 0,
  missingExtracted: 0,

  organizations: 0,
  people: 0,
  unknown: 0,

  validEdrpou: 0,

  updated: 0,
  unchanged: 0,
};

for (const document of documents) {
  const items =
    document.payload
      ?.data
      ?.step_11
      ?.data ??
    [];

  const extractedIncomeFacts =
    extractNazkFacts(
      document.payload,
      {
        documentGuid:
          document.document_guid ??
          document.payload?.id ??
          null,
      },
    ).filter(
      (fact) =>
        fact.factType ===
        "income",
    );

  const extractedIndex =
    new Map(
      extractedIncomeFacts.map(
        (fact) => [
          String(
            fact.metadata
              ?.item_ref ??
            "",
          ),
          fact,
        ],
      ),
    );

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    stats.rawItems += 1;

    const item =
      items[index];

    const ref =
      itemRef(item, index);

    const fact =
      factIndex.get(
        [
          document.id,
          ref,
        ].join("|"),
      );

    if (!fact) {
      stats.missingFacts += 1;
      continue;
    }

    stats.matchedFacts += 1;

    const extractedFact =
      extractedIndex.get(ref);

    if (!extractedFact) {
      stats.missingExtracted += 1;
      continue;
    }

    const details =
      extractedFact.valueJson
        ?.source_details ??
      null;

    if (!details) {
      stats.missingExtracted += 1;
      continue;
    }

    if (
      details.source_type ===
      "organization"
    ) {
      stats.organizations += 1;
    } else if (
      details.source_type ===
      "person"
    ) {
      stats.people += 1;
    } else {
      stats.unknown += 1;
    }

    if (details.edrpou) {
      stats.validEdrpou += 1;
    }

    if (dryRun) {
      if (
        fact.source_details &&
        JSON.stringify(
          fact.source_details,
        ) ===
          JSON.stringify(
            details,
          )
      ) {
        stats.unchanged += 1;
      } else {
        stats.updated += 1;
      }

      continue;
    }

    const result = await sql`
      UPDATE facts

      SET
        value_json =
          COALESCE(
            value_json,
            '{}'::jsonb
          )
          ||
          jsonb_build_object(
            'source_details',
            ${JSON.stringify(
              details,
            )}::jsonb
          ),

        metadata =
          COALESCE(
            metadata,
            '{}'::jsonb
          )
          ||
          jsonb_build_object(
            'income_source_enriched',
            true,
            'income_source_version',
            'income-source-v1'
          )

      WHERE id = ${fact.id}

        AND (
          value_json
          -> 'source_details'
        )
        IS DISTINCT FROM
          ${JSON.stringify(
            details,
          )}::jsonb

      RETURNING id
    `;

    if (result.length) {
      stats.updated += 1;
    } else {
      stats.unchanged += 1;
    }
  }
}

console.log(
  dryRun
    ? "\n=== INCOME SOURCE ENRICHMENT DRY RUN ==="
    : "\n=== INCOME SOURCE ENRICHMENT ===",
);

console.table([stats]);

if (
  stats.missingFacts ||
  stats.missingExtracted
) {
  process.exitCode = 1;
}
