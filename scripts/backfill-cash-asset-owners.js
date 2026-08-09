import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  isDeepStrictEqual,
} from "node:util";

import {
  db,
} from "../src/db.js";

import {
  extractNazkFacts,
} from "../src/nazk-fact-extractor.js";

const sql =
  db();

const apply =
  process.argv.includes(
    "--apply"
  );

const documents =
  await sql`
    SELECT
      id AS source_document_id,

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

    ORDER BY
      created_at ASC
  `;

const stats = {
  documents:
    documents.length,

  extracted_cash:
    0,

  matched:
    0,

  would_update:
    0,

  updated:
    0,

  already_current:
    0,

  unmatched:
    0,

  unique_owner:
    0,

  joint_owner:
    0,

  unresolved_owner:
    0,
};

const changes =
  [];

for (
  const document
  of documents
) {
  const facts =
    extractNazkFacts(
      document.payload,
      {
        documentGuid:
          document.document_guid,
      }
    );

  const cashFacts =
    facts.filter(
      (fact) =>
        fact.factType ===
        "cash_asset"
    );

  stats.extracted_cash +=
    cashFacts.length;

  for (
    const fact
    of cashFacts
  ) {
    const rows =
      await sql`
        SELECT
          id,
          source_document_id,
          fact_key,
          metadata,
          value_json

        FROM facts

        WHERE
          fact_type =
            'cash_asset'

          AND fact_key =
            ${fact.factKey}

          AND source_document_id =
            ${document.source_document_id}

        LIMIT 2
      `;

    if (
      rows.length !== 1
    ) {
      stats.unmatched += 1;

      console.log(
        "UNMATCHED:",
        {
          document_guid:
            document.document_guid,

          item_ref:
            fact.metadata
              ?.item_ref,

          matches:
            rows.length,
        }
      );

      continue;
    }

    stats.matched += 1;

    const row =
      rows[0];

    const person =
      fact.valueJson
        ?.person ??
      null;

    const rights =
      fact.valueJson
        ?.rights ??
      [];

    const knownRoles =
      new Set([
        "declarant",
        "family",
      ]);

    const knownRightRefs =
      new Set(
        rights
          .filter(
            (right) =>
              knownRoles.has(
                right
                  ?.actor
                  ?.role
              )
          )
          .map(
            (right) =>
              right
                ?.actor
                ?.ref
          )
          .filter(Boolean)
      );

    const unresolvedRights =
      rights.filter(
        (right) =>
          !knownRoles.has(
            right
              ?.actor
              ?.role
          )
      );

    let ownershipMode =
      "unresolved";

    if (
      knownRoles.has(
        person?.role
      )
    ) {
      ownershipMode =
        "unique";

      stats.unique_owner +=
        1;
    } else if (
      !person &&
      knownRightRefs.size > 1 &&
      unresolvedRights.length === 0
    ) {
      ownershipMode =
        "joint";

      stats.joint_owner +=
        1;
    } else {
      stats.unresolved_owner +=
        1;
    }

    const current =
      row.value_json ??
      {};

    const next =
      {
        ...current,

        person,

        rights,
      };

    const currentRelevant = {
      person:
        current.person ??
        null,

      rights:
        current.rights ??
        [],
    };

    const nextRelevant = {
      person,
      rights,
    };

    if (
      isDeepStrictEqual(
        currentRelevant,
        nextRelevant
      )
    ) {
      stats.already_current +=
        1;

      continue;
    }

    stats.would_update +=
      1;

    changes.push({
      id:
        row.id,

      source_document_id:
        row.source_document_id,

      fact_key:
        row.fact_key,

      metadata:
        row.metadata,

      before:
        current,

      after:
        next,

      ownership_mode:
        ownershipMode,
    });
  }
}

let backup = null;

if (
  apply &&
  changes.length
) {
  const directory =
    path.join(
      os.homedir(),
      "Desktop",
      "person-monitor-backups"
    );

  await fs.mkdir(
    directory,
    {
      recursive: true,
      mode: 0o700,
    }
  );

  const timestamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      );

  backup =
    path.join(
      directory,
      `cash-assets-before-owner-backfill-${timestamp}.json`
    );

  const payload =
    JSON.stringify(
      changes,
      null,
      2
    );

  await fs.writeFile(
    backup,
    payload,
    {
      mode: 0o600,
    }
  );

  const sha256 =
    crypto
      .createHash(
        "sha256"
      )
      .update(payload)
      .digest("hex");

  console.log(
    "\nBACKUP:",
    backup
  );

  console.log(
    "BACKUP SHA256:",
    sha256
  );
}

/*
 * ВАЖЛИВО:
 * UPDATE виконуємо тільки після того,
 * як backup успішно записаний.
 */
if (apply) {
  for (
    const change
    of changes
  ) {
    await sql`
      UPDATE facts

      SET value_json =
        ${JSON.stringify(
          change.after
        )}::jsonb

      WHERE id =
        ${change.id}
    `;

    stats.updated += 1;
  }
}

console.log(
  apply
    ? "\n=== CASH OWNER BACKFILL ==="
    : "\n=== CASH OWNER BACKFILL DRY RUN ==="
);

console.table([
  stats,
]);

const roleCounts = {};

const sums = {};

for (
  const change
  of changes
) {
  const person =
    change.after
      ?.person;

  const role =
    change
      .ownership_mode ===
      "joint"
        ? "joint"
        : (
            person?.role ??
            "unresolved"
          );

  const currency =
    String(
      change.after
        ?.currency ??
      ""
    );

  const amount =
    Number(
      change.after
        ?.amount
    );

  roleCounts[role] =
    (
      roleCounts[role] ??
      0
    ) + 1;

  const key =
    `${role}|${currency}`;

  sums[key] =
    (
      sums[key] ??
      0
    ) +
    (
      Number.isFinite(
        amount
      )
        ? amount
        : 0
    );
}

console.log(
  "\nCHANGED ROLE COUNTS:",
  roleCounts
);

console.log(
  "\n=== CHANGED SUMS ==="
);

console.table(
  Object.entries(
    sums
  ).map(
    ([key, amount]) => {
      const [
        role,
        currency,
      ] =
        key.split("|");

      return {
        role,
        currency,
        amount,
      };
    }
  )
);

if (
  stats.unmatched !== 0
) {
  throw new Error(
    "CASH_BACKFILL_HAS_UNMATCHED_FACTS"
  );
}

if (
  stats.unresolved_owner !== 0
) {
  throw new Error(
    "CASH_BACKFILL_HAS_UNRESOLVED_OWNERS"
  );
}

if (
  apply &&
  stats.updated !==
    stats.would_update
) {
  throw new Error(
    "CASH_BACKFILL_UPDATE_COUNT_MISMATCH"
  );
}
