import { db } from "../src/db.js";

import {
  extractThirdPartyRightIdentity,
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
    fact_type,
    source_document_id,

    metadata ->> 'item_ref'
      AS item_ref,

    value_json

  FROM facts

  WHERE fact_type IN (
    'real_estate',
    'vehicle'
  )
`;

const factIndex = new Map();

for (const fact of facts) {
  factIndex.set(
    [
      fact.source_document_id,
      fact.fact_type,
      fact.item_ref,
    ].join("|"),
    fact,
  );
}

const documents = await sql`
  SELECT
    id,

    raw_payload
      -> 'nazk_document'
      -> 'data'
      -> 'step_3'
      -> 'data'
      AS real_estate,

    raw_payload
      -> 'nazk_document'
      -> 'data'
      -> 'step_6'
      -> 'data'
      AS vehicles

  FROM source_documents

  WHERE
    raw_payload
      -> 'nazk_document'
      IS NOT NULL
`;

const stats = {
  rawAssetItems: 0,
  matchedFacts: 0,
  missingFacts: 0,

  thirdPartyRights: 0,

  organizationRights: 0,
  personRights: 0,
  unknownRights: 0,

  rightsLengthMismatches: 0,

  updatedFacts: 0,
  unchangedFacts: 0,
};

async function processItems(
  document,
  factType,
  items,
) {
  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    stats.rawAssetItems += 1;

    const rawItem =
      items[index];

    const ref =
      itemRef(
        rawItem,
        index,
      );

    const fact =
      factIndex.get(
        [
          document.id,
          factType,
          ref,
        ].join("|"),
      );

    if (!fact) {
      stats.missingFacts += 1;
      continue;
    }

    stats.matchedFacts += 1;

    const rawRights =
      Array.isArray(
        rawItem?.rights,
      )
        ? rawItem.rights
        : [];

    const currentRights =
      Array.isArray(
        fact.value_json?.rights,
      )
        ? fact.value_json.rights
        : [];

    if (
      rawRights.length !==
      currentRights.length
    ) {
      stats
        .rightsLengthMismatches +=
        1;
    }

    const enrichedRights =
      currentRights.map(
        (current, rightIndex) => {
          if (
            current
              ?.belongs_ref !==
            "j"
          ) {
            return current;
          }

          stats.thirdPartyRights +=
            1;

          const identity =
            extractThirdPartyRightIdentity(
              rawRights[
                rightIndex
              ] ?? {},
            );

          if (
            identity.kind ===
            "organization"
          ) {
            stats
              .organizationRights +=
              1;
          } else if (
            identity.kind ===
            "person"
          ) {
            stats.personRights +=
              1;
          } else {
            stats.unknownRights +=
              1;
          }

          return {
            ...current,

            third_party_name:
              identity.name,

            third_party_kind:
              identity.kind,

            third_party_edrpou:
              identity.edrpou,

            third_party_foreign_code:
              identity
                .foreign_company_code,
          };
        },
      );

    const changed =
      JSON.stringify(
        currentRights,
      ) !==
      JSON.stringify(
        enrichedRights,
      );

    if (!changed) {
      stats.unchangedFacts += 1;
      continue;
    }

    stats.updatedFacts += 1;

    if (dryRun) {
      continue;
    }

    await sql`
      UPDATE facts

      SET
        value_json =
          jsonb_set(
            COALESCE(
              value_json,
              '{}'::jsonb
            ),

            '{rights}',

            ${JSON.stringify(
              enrichedRights,
            )}::jsonb,

            true
          ),

        metadata =
          COALESCE(
            metadata,
            '{}'::jsonb
          )
          ||
          jsonb_build_object(
            'third_party_enriched',
            true,

            'third_party_version',
            'third-party-v1'
          )

      WHERE id = ${fact.id}
    `;
  }
}

for (const document of documents) {
  await processItems(
    document,
    "real_estate",
    Array.isArray(
      document.real_estate,
    )
      ? document.real_estate
      : [],
  );

  await processItems(
    document,
    "vehicle",
    Array.isArray(
      document.vehicles,
    )
      ? document.vehicles
      : [],
  );
}

console.log(
  dryRun
    ? "\n=== THIRD PARTY ENRICHMENT DRY RUN ==="
    : "\n=== THIRD PARTY ENRICHMENT ===",
);

console.table([stats]);

if (
  stats.missingFacts > 0 ||
  stats.rightsLengthMismatches > 0
) {
  process.exitCode = 1;
}
