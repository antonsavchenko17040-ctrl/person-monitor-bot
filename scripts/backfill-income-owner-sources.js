import {
  db,
} from "../src/db.js";

import {
  extractNazkFacts,
} from "../src/nazk-fact-extractor.js";

const sql = db();

const apply =
  process.argv.includes("--apply");

function canonical(value) {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(
        (key) => [
          key,
          canonical(value[key]),
        ],
      ),
  );
}

function sameJson(left, right) {
  return (
    JSON.stringify(
      canonical(left),
    ) ===
    JSON.stringify(
      canonical(right),
    )
  );
}

function comparable(valueJson) {
  return {
    person:
      valueJson?.person ??
      null,

    source:
      valueJson?.source ??
      null,

    source_details:
      valueJson
        ?.source_details ??
      null,
  };
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
    raw_payload
      ? 'nazk_document'

    AND jsonb_typeof(
      raw_payload
        -> 'nazk_document'
        -> 'data'
        -> 'step_11'
        -> 'data'
    ) = 'array'

  ORDER BY created_at ASC
`;

const existingFacts = await sql`
  SELECT
    id,
    source_document_id,

    metadata
      ->> 'item_ref'
      AS item_ref,

    value_json

  FROM facts

  WHERE fact_type = 'income'
`;

const existingIndex =
  new Map();

for (const fact of existingFacts) {
  const key = [
    fact.source_document_id,
    fact.item_ref,
  ].join("|");

  if (!existingIndex.has(key)) {
    existingIndex.set(
      key,
      [],
    );
  }

  existingIndex
    .get(key)
    .push(fact);
}

const stats = {
  documents:
    documents.length,

  extractedIncomeFacts: 0,
  matched: 0,

  missingExisting: 0,
  duplicateExisting: 0,

  needsUpdate: 0,
  unchanged: 0,

  declarant: 0,
  family: 0,
  unknownOwner: 0,

  organizationSource: 0,
  personSource: 0,
  unknownSource: 0,

  updated: 0,
};

const plan = [];

for (const document of documents) {
  const extracted =
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

  for (const fact of extracted) {
    stats.extractedIncomeFacts += 1;

    const role =
      fact.valueJson
        ?.person
        ?.role ??
      null;

    if (role === "declarant") {
      stats.declarant += 1;
    } else if (role === "family") {
      stats.family += 1;
    } else {
      stats.unknownOwner += 1;
    }

    const sourceType =
      fact.valueJson
        ?.source_details
        ?.source_type ??
      null;

    if (
      sourceType ===
      "organization"
    ) {
      stats.organizationSource += 1;
    } else if (
      sourceType === "person"
    ) {
      stats.personSource += 1;
    } else {
      stats.unknownSource += 1;
    }

    const itemRef =
      String(
        fact.metadata
          ?.item_ref ??
        "",
      );

    const key = [
      document.id,
      itemRef,
    ].join("|");

    const matches =
      existingIndex.get(key) ??
      [];

    if (!matches.length) {
      stats.missingExisting += 1;

      continue;
    }

    if (matches.length !== 1) {
      stats.duplicateExisting += 1;

      continue;
    }

    stats.matched += 1;

    const existingFact =
      matches[0];

    const oldValue =
      comparable(
        existingFact.value_json,
      );

    const newValue =
      comparable(
        fact.valueJson,
      );

    if (
      sameJson(
        oldValue,
        newValue,
      )
    ) {
      stats.unchanged += 1;

      continue;
    }

    stats.needsUpdate += 1;

    plan.push({
      id:
        existingFact.id,

      source_document_id:
        document.id,

      item_ref:
        itemRef,

      old:
        oldValue,

      expected:
        newValue,
    });
  }
}

const invariantsOk =
  stats.missingExisting === 0 &&
  stats.duplicateExisting === 0 &&
  stats.unknownOwner === 0 &&
  stats.unknownSource === 0 &&
  stats.matched ===
    stats.extractedIncomeFacts;

console.log(
  apply
    ? "\n=== INCOME OWNER/SOURCE BACKFILL APPLY ==="
    : "\n=== INCOME OWNER/SOURCE BACKFILL DRY RUN ===",
);

console.table([
  stats,
]);

console.log(
  "\n=== FIRST PLANNED CHANGES ===",
);

console.table(
  plan
    .slice(0, 20)
    .map(
      (item) => ({
        fact_id:
          item.id,

        source_document_id:
          item.source_document_id,

        item_ref:
          item.item_ref,

        old_role:
          item.old
            .person
            ?.role ??
          null,

        new_role:
          item.expected
            .person
            ?.role ??
          null,

        old_source_type:
          item.old
            .source_details
            ?.source_type ??
          null,

        new_source_type:
          item.expected
            .source_details
            ?.source_type ??
          null,
      }),
    ),
);

console.log(
  "\nPlanned updates:",
  plan.length,
);

console.log(
  "Invariants OK:",
  invariantsOk,
);

if (!invariantsOk) {
  throw new Error(
    "BACKFILL_INVARIANTS_FAILED",
  );
}

if (!apply) {
  console.log(
    "\nNO DATABASE CHANGES MADE",
  );

  console.log(
    "INCOME_BACKFILL_DRY_RUN_OK",
  );

  process.exit(0);
}

const patches =
  plan.map(
    (item) => ({
      id:
        item.id,

      person:
        item.expected.person,

      source:
        item.expected.source,

      source_details:
        item.expected
          .source_details,
    }),
  );

if (patches.length) {
  const result = await sql`
    WITH patch AS (
      SELECT
        (item ->> 'id')::uuid
          AS id,

        item -> 'person'
          AS person,

        item -> 'source'
          AS source,

        item -> 'source_details'
          AS source_details

      FROM jsonb_array_elements(
        ${JSON.stringify(
          patches,
        )}::jsonb
      ) AS item
    )

    UPDATE facts AS fact

    SET
      value_json =
        COALESCE(
          fact.value_json,
          '{}'::jsonb
        )
        ||
        jsonb_build_object(
          'person',
          patch.person,

          'source',
          patch.source,

          'source_details',
          patch.source_details
        )

    FROM patch

    WHERE
      fact.id = patch.id

      AND fact.fact_type =
        'income'

    RETURNING fact.id
  `;

  stats.updated =
    result.length;

  if (
    stats.updated !==
    patches.length
  ) {
    throw new Error(
      `BACKFILL_UPDATE_COUNT_MISMATCH:${stats.updated}/${patches.length}`,
    );
  }
}

console.log(
  "\nUpdated:",
  stats.updated,
);

console.log(
  "INCOME_BACKFILL_APPLY_OK",
);
