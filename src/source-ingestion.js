import { db } from "./db.js";
import { stableFingerprint } from "./utils.js";

export function parseNazkDeclarationDocumentGuid(url) {
  const match = String(url ?? "").match(
    /\/v2\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i,
  );

  return match?.[1]?.toLowerCase() ?? null;
}

export function parseNazkDeclarationYear(title) {
  const match = String(title ?? "").match(
    /(?:—|-)\s*(20\d{2})\s*$/u,
  );

  return match ? Number(match[1]) : null;
}

export function parseNazkDeclarationName(title) {
  return String(title ?? "")
    .replace(/^Декларація НАЗК:\s*/iu, "")
    .replace(/\s+(?:—|-)\s*20\d{2}\s*$/u, "")
    .trim() || null;
}

function bootstrapResolution(row) {
  const confirmed =
    row.entity_id &&
    row.match_level === "confirmed" &&
    Number(row.match_score) >= 85;

  if (confirmed) {
    return {
      status: "matched",
      entityId: row.entity_id,
      score: Number(row.match_score),
      level: "confirmed",
      reasons: [
        "Bootstrap із підтвердженого legacy mention",
        ...(Array.isArray(row.reasons) ? row.reasons : []),
      ],
    };
  }

  return {
    status: "ambiguous",
    entityId: null,
    score: Number(row.match_score) || 0,
    level: row.match_level ?? "unknown",
    reasons: [
      "Legacy mention не має достатнього підтвердження для автоматичного перенесення",
    ],
  };
}

async function loadDeclarationRows(sql, limit = 1000) {
  return sql`
    SELECT
      sd.id AS source_document_id,
      sd.metadata AS source_document_metadata,

      m.id AS mention_id,
      m.entity_id,
      m.subject_id,
      m.provider,
      m.title,
      m.url,
      m.source,
      m.published_at,
      m.match_score,
      m.match_level,
      m.reasons,

      s.full_name AS subject_full_name

    FROM mentions m

    JOIN source_documents sd
      ON sd.id = m.source_document_id

    JOIN subjects s
      ON s.id = m.subject_id

    WHERE m.provider = 'nazk-declarations'

    ORDER BY m.first_seen_at ASC

    LIMIT ${limit}
  `;
}

export async function previewNazkDeclarationBootstrap(
  options = {},
) {
  const sql = options.sql ?? db();
  const rows = await loadDeclarationRows(
    sql,
    options.limit ?? 1000,
  );

  return rows.map((row) => {
    const documentGuid =
      parseNazkDeclarationDocumentGuid(row.url);

    const declarationYear =
      parseNazkDeclarationYear(row.title);

    const declarationName =
      parseNazkDeclarationName(row.title);

    const resolution =
      bootstrapResolution(row);

    return {
      sourceDocumentId: row.source_document_id,
      mentionId: row.mention_id,

      documentGuid,
      declarationYear,
      declarationName,

      entityId: resolution.entityId,
      score: resolution.score,
      status: resolution.status,
      level: resolution.level,

      valid:
        Boolean(documentGuid) &&
        Boolean(declarationYear) &&
        Boolean(declarationName),
    };
  });
}

async function saveObservation(
  sql,
  row,
  parsed,
  resolution,
) {
  const fingerprint = stableFingerprint(
    "legacy-nazk-bootstrap-v1",
    row.source_document_id,
    row.mention_id,
    parsed.documentGuid ?? "",
    resolution.entityId ?? "",
  );

  const details = {
    bootstrap: true,
    source_provider: row.provider,
    legacy_mention_id: row.mention_id,
    document_guid: parsed.documentGuid,
    declaration_year: parsed.declarationYear,
  };

  await sql`
    INSERT INTO identity_observations (
      fingerprint,
      source_document_id,
      observed_entity_type,
      observed_name,
      observed_identifiers,
      observed_payload,
      resolution_status,
      resolved_entity_id,
      resolution_score,
      resolution_level,
      resolution_reasons,
      resolver_version,
      details
    )
    VALUES (
      ${fingerprint},
      ${row.source_document_id},
      'person',
      ${parsed.declarationName},
      '[]'::jsonb,
      ${JSON.stringify({
        title: row.title,
        provider: row.provider,
        declaration_name:
          parsed.declarationName,
        declaration_year:
          parsed.declarationYear,
        document_guid:
          parsed.documentGuid,
      })}::jsonb,
      ${resolution.status},
      ${resolution.entityId},
      ${resolution.score},
      ${resolution.level},
      ${JSON.stringify(
        resolution.reasons,
      )}::jsonb,
      'legacy-nazk-bootstrap-v1',
      ${JSON.stringify(details)}::jsonb
    )

    ON CONFLICT (fingerprint)

    DO UPDATE SET
      resolution_status =
        EXCLUDED.resolution_status,
      resolved_entity_id =
        EXCLUDED.resolved_entity_id,
      resolution_score =
        EXCLUDED.resolution_score,
      resolution_level =
        EXCLUDED.resolution_level,
      resolution_reasons =
        EXCLUDED.resolution_reasons,
      details =
        EXCLUDED.details,
      updated_at = now()
  `;

  return fingerprint;
}

async function saveDeclarationFact(
  sql,
  row,
  parsed,
  resolution,
) {
  if (
    resolution.status !== "matched" ||
    !resolution.entityId
  ) {
    return false;
  }

  const factKey = stableFingerprint(
    "nazk-declaration-submission-v1",
    parsed.documentGuid,
  );

  const publishedDate =
    row.published_at
      ? String(row.published_at).slice(0, 10)
      : null;

  const value = {
    document_guid: parsed.documentGuid,
    declaration_year: parsed.declarationYear,
    declaration_name: parsed.declarationName,
    published_at: row.published_at ?? null,
    url: row.url,
    registry:
      "Єдиний державний реєстр декларацій НАЗК",
  };

  const inserted = await sql`
    INSERT INTO facts (
      entity_id,
      fact_type,
      value_date,
      value_json,
      source_document_id,
      confidence,
      verification_status,
      metadata,
      fact_key
    )
    VALUES (
      ${resolution.entityId},
      'declaration_submission',
      ${publishedDate},
      ${JSON.stringify(value)}::jsonb,
      ${row.source_document_id},
      ${Math.min(
        100,
        Math.max(0, resolution.score),
      )},
      'legacy_confirmed',
      ${JSON.stringify({
        ingestion:
          "nazk-declaration-bootstrap-v1",
        legacy_mention_id:
          row.mention_id,
        document_guid:
          parsed.documentGuid,
      })}::jsonb,
      ${factKey}
    )

    ON CONFLICT DO NOTHING

    RETURNING id
  `;

  return inserted.length > 0;
}

async function saveCrossCheck(
  sql,
  row,
  parsed,
  resolution,
  fingerprint,
) {
  const checkKey = stableFingerprint(
    "nazk-bootstrap-cross-check-v1",
    row.source_document_id,
    parsed.documentGuid ?? "",
  );

  await sql`
    INSERT INTO cross_checks (
      entity_id,
      check_type,
      rule_code,
      left_source_document_id,
      result,
      score,
      details
    )

    SELECT
      ${resolution.entityId},
      'source_entity_link',
      'NAZK_BOOTSTRAP_V1',
      ${row.source_document_id},
      ${
        resolution.status === "matched"
          ? "match"
          : "ambiguous"
      },
      ${resolution.score},
      ${JSON.stringify({
        check_key: checkKey,
        observation_fingerprint:
          fingerprint,
        document_guid:
          parsed.documentGuid,
        declaration_year:
          parsed.declarationYear,
        legacy_mention_id:
          row.mention_id,
      })}::jsonb

    WHERE NOT EXISTS (
      SELECT 1
      FROM cross_checks
      WHERE details ->> 'check_key' =
        ${checkKey}
    )
  `;
}

async function markSourceDocument(
  sql,
  row,
  parsed,
  resolution,
) {
  const metadata = {
    document_kind:
      "nazk_declaration",

    document_guid:
      parsed.documentGuid,

    declaration_year:
      parsed.declarationYear,

    declaration_name:
      parsed.declarationName,

    ingestion_status:
      resolution.status,

    ingestion_version:
      "nazk-declaration-bootstrap-v1",
  };

  await sql`
    UPDATE source_documents
    SET metadata =
      COALESCE(metadata, '{}'::jsonb)
      ||
      ${JSON.stringify(metadata)}::jsonb
    WHERE id = ${row.source_document_id}
  `;
}

export async function bootstrapNazkDeclarations(
  options = {},
) {
  const sql = options.sql ?? db();

  const dryRun =
    options.dryRun === true;

  const rows = await loadDeclarationRows(
    sql,
    options.limit ?? 1000,
  );

  const stats = {
    scanned: 0,
    valid: 0,
    matched: 0,
    ambiguous: 0,
    factsInserted: 0,
    invalid: 0,
  };

  for (const row of rows) {
    stats.scanned += 1;

    const parsed = {
      documentGuid:
        parseNazkDeclarationDocumentGuid(
          row.url,
        ),

      declarationYear:
        parseNazkDeclarationYear(
          row.title,
        ),

      declarationName:
        parseNazkDeclarationName(
          row.title,
        ),
    };

    if (
      !parsed.documentGuid ||
      !parsed.declarationYear ||
      !parsed.declarationName
    ) {
      stats.invalid += 1;
      continue;
    }

    stats.valid += 1;

    const resolution =
      bootstrapResolution(row);

    if (resolution.status === "matched") {
      stats.matched += 1;
    } else {
      stats.ambiguous += 1;
    }

    if (dryRun) {
      continue;
    }

    const fingerprint =
      await saveObservation(
        sql,
        row,
        parsed,
        resolution,
      );

    const inserted =
      await saveDeclarationFact(
        sql,
        row,
        parsed,
        resolution,
      );

    if (inserted) {
      stats.factsInserted += 1;
    }

    await saveCrossCheck(
      sql,
      row,
      parsed,
      resolution,
      fingerprint,
    );

    await markSourceDocument(
      sql,
      row,
      parsed,
      resolution,
    );
  }

  return stats;
}
