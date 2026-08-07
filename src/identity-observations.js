import { db } from "./db.js";
import {
  resolvePersonIdentity,
} from "./entity-resolution.js";
import {
  normalizeText,
  stableFingerprint,
} from "./utils.js";

export const HARD_IDENTIFIER_TYPES = new Set([
  "subject_id",
  "guid",
  "person_guid",
  "nazk_guid",
  "external_guid",
  "declarant_guid",
  "opendatabot_person_id",
]);

export function isHardIdentifierType(type) {
  return HARD_IDENTIFIER_TYPES.has(
    String(type ?? "").trim().toLowerCase(),
  );
}

export function normalizeIdentifierValue(type, value) {
  const normalizedType = String(type ?? "")
    .trim()
    .toLowerCase();

  const raw = String(value ?? "").trim();

  if (!normalizedType || !raw) {
    return null;
  }

  if (
    normalizedType === "guid" ||
    normalizedType.endsWith("_guid")
  ) {
    return raw
      .toLowerCase()
      .replace(/[{}]/g, "");
  }

  if (
    normalizedType === "full_name" ||
    normalizedType === "alias"
  ) {
    return normalizeText(raw);
  }

  return raw.toLowerCase();
}

function normalizeIdentifiers(input) {
  const result = [];

  if (input.guid) {
    result.push({
      type: input.guidType ?? "guid",
      value: input.guid,
      source: input.guidSource ?? null,
      confidence: 100,
    });
  }

  for (const item of input.identifiers ?? []) {
    result.push({
      type: item.type,
      value: item.value,
      source: item.source ?? null,
      confidence:
        Number.isFinite(Number(item.confidence))
          ? Number(item.confidence)
          : 100,
    });
  }

  const unique = new Map();

  for (const item of result) {
    const type = String(item.type ?? "")
      .trim()
      .toLowerCase();

    const normalizedValue =
      normalizeIdentifierValue(type, item.value);

    if (!type || !normalizedValue) {
      continue;
    }

    const source =
      item.source == null
        ? null
        : String(item.source).trim();

    const key = [
      type,
      normalizedValue,
      source ?? "",
    ].join("|");

    unique.set(key, {
      type,
      value: String(item.value).trim(),
      normalizedValue,
      source,
      confidence: Math.max(
        0,
        Math.min(100, item.confidence),
      ),
      hard: isHardIdentifierType(type),
    });
  }

  return [...unique.values()];
}

async function findHardMatches(sql, identifiers) {
  const matches = [];

  for (const identifier of identifiers) {
    if (!identifier.hard) {
      continue;
    }

    const rows = identifier.source
      ? await sql`
          SELECT
            ei.entity_id,
            e.canonical_name
          FROM entity_identifiers ei
          JOIN entities e
            ON e.id = ei.entity_id
          WHERE ei.identifier_type = ${identifier.type}
            AND ei.normalized_value = ${identifier.normalizedValue}
            AND ei.source = ${identifier.source}
        `
      : await sql`
          SELECT
            ei.entity_id,
            e.canonical_name
          FROM entity_identifiers ei
          JOIN entities e
            ON e.id = ei.entity_id
          WHERE ei.identifier_type = ${identifier.type}
            AND ei.normalized_value = ${identifier.normalizedValue}
        `;

    for (const row of rows) {
      matches.push({
        identifier,
        entityId: row.entity_id,
        canonicalName: row.canonical_name,
      });
    }
  }

  return matches;
}

async function findContradictions(
  sql,
  entityId,
  identifiers,
) {
  const contradictions = [];

  for (const identifier of identifiers) {
    if (!identifier.hard) {
      continue;
    }

    const rows = identifier.source
      ? await sql`
          SELECT
            identifier_value,
            normalized_value
          FROM entity_identifiers
          WHERE entity_id = ${entityId}
            AND identifier_type = ${identifier.type}
            AND source = ${identifier.source}
        `
      : await sql`
          SELECT
            identifier_value,
            normalized_value
          FROM entity_identifiers
          WHERE entity_id = ${entityId}
            AND identifier_type = ${identifier.type}
        `;

    if (
      rows.length > 0 &&
      !rows.some(
        (row) =>
          row.normalized_value ===
          identifier.normalizedValue,
      )
    ) {
      contradictions.push({
        type: identifier.type,
        incoming: identifier.value,
        existing: rows.map(
          (row) => row.identifier_value,
        ),
      });
    }
  }

  return contradictions;
}

export function decisionFromFuzzy(best) {
  if (!best || best.level === "rejected") {
    return {
      status: "unmatched",
      decision: "new_entity_candidate",
    };
  }

  if (
    best.level === "confirmed" &&
    best.score >= 85
  ) {
    return {
      status: "matched",
      decision: "existing_entity",
    };
  }

  if (best.score >= 55) {
    return {
      status: "ambiguous",
      decision: "manual_review",
    };
  }

  return {
    status: "unmatched",
    decision: "new_entity_candidate",
  };
}

export async function previewPersonObservation(
  input,
  options = {},
) {
  const sql = options.sql ?? db();

  const identifiers = normalizeIdentifiers(input);

  const hardMatches =
    await findHardMatches(sql, identifiers);

  const matchedEntityIds = [
    ...new Set(
      hardMatches.map((item) =>
        String(item.entityId),
      ),
    ),
  ];

  /*
   * Two hard identifiers from the same source payload
   * point to different people.
   *
   * Never auto-merge this.
   */
  if (matchedEntityIds.length > 1) {
    return {
      status: "conflict",
      decision: "manual_review",
      entityId: null,
      canonicalName: null,
      score: null,
      level: "conflict",
      hardMatch: false,
      reasons: [
        "Стабільні ідентифікатори вказують на різні entities",
      ],
      identifiers,
      hardMatches,
    };
  }

  /*
   * Exact stable identifier wins over fuzzy name matching.
   */
  if (matchedEntityIds.length === 1) {
    const entityId = matchedEntityIds[0];

    const contradictions =
      await findContradictions(
        sql,
        entityId,
        identifiers,
      );

    if (contradictions.length > 0) {
      return {
        status: "conflict",
        decision: "manual_review",
        entityId: null,
        canonicalName: null,
        score: null,
        level: "conflict",
        hardMatch: false,
        reasons: [
          "Новий стабільний ідентифікатор суперечить даним існуючої entity",
        ],
        identifiers,
        contradictions,
      };
    }

    const matched = hardMatches.find(
      (item) =>
        String(item.entityId) === entityId,
    );

    return {
      status: "matched",
      decision: "existing_entity",
      entityId,
      canonicalName:
        matched?.canonicalName ?? null,
      score: 100,
      level: "confirmed",
      hardMatch: true,
      reasons: [
        `Точний збіг стабільного ідентифікатора: ${matched?.identifier.type ?? "unknown"}`,
      ],
      identifiers,
    };
  }

  /*
   * No stable identifier matched:
   * use PІБ + position + organization + city.
   */
  const fuzzy = await resolvePersonIdentity(
    {
      fullName: input.fullName ?? null,
      position: input.position ?? null,
      organization: input.organization ?? null,
      city: input.city ?? null,
    },
    { sql },
  );

  const best = fuzzy.best;

  const decision = decisionFromFuzzy(best);

  if (
    decision.status === "matched" &&
    best?.entityId
  ) {
    const contradictions =
      await findContradictions(
        sql,
        best.entityId,
        identifiers,
      );

    if (contradictions.length > 0) {
      return {
        status: "conflict",
        decision: "manual_review",
        entityId: null,
        canonicalName: null,
        score: best.score,
        level: "conflict",
        hardMatch: false,
        reasons: [
          ...best.reasons,
          "Стабільний ідентифікатор суперечить знайденій entity",
        ],
        identifiers,
        contradictions,
        candidates: fuzzy.candidates,
      };
    }
  }

  return {
    ...decision,

    entityId:
      decision.status === "matched"
        ? best?.entityId ?? null
        : null,

    canonicalName:
      decision.status === "matched"
        ? best?.canonicalName ?? null
        : null,

    score: best?.score ?? 0,
    level: best?.level ?? "rejected",
    hardMatch: best?.hardMatch ?? false,

    reasons:
      best?.reasons?.length
        ? best.reasons
        : ["Недостатньо даних для ідентифікації"],

    identifiers,

    candidates:
      fuzzy.candidates?.slice(0, 5) ?? [],
  };
}

async function registerHardIdentifiers(
  sql,
  entityId,
  identifiers,
  sourceDocumentId,
  observationFingerprint,
) {
  for (const identifier of identifiers) {
    if (!identifier.hard) {
      continue;
    }

    const existing = await sql`
      SELECT
        entity_id
      FROM entity_identifiers
      WHERE identifier_type = ${identifier.type}
        AND normalized_value = ${identifier.normalizedValue}
      LIMIT 1
    `;

    if (
      existing.length > 0 &&
      String(existing[0].entity_id) !==
        String(entityId)
    ) {
      throw new Error(
        `Identifier conflict: ${identifier.type}`,
      );
    }

    await sql`
      INSERT INTO entity_identifiers (
        entity_id,
        identifier_type,
        identifier_value,
        normalized_value,
        source,
        confidence,
        is_primary,
        source_document_id,
        metadata
      )
      SELECT
        ${entityId},
        ${identifier.type},
        ${identifier.value},
        ${identifier.normalizedValue},
        ${identifier.source},
        ${identifier.confidence},
        false,
        ${sourceDocumentId ?? null},
        ${JSON.stringify({
          registered_by:
            "identity_observation",
          observation_fingerprint:
            observationFingerprint,
        })}::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM entity_identifiers
        WHERE entity_id = ${entityId}
          AND identifier_type = ${identifier.type}
          AND normalized_value = ${identifier.normalizedValue}
      )
      ON CONFLICT DO NOTHING
    `;
  }
}

async function recordCrossCheck(
  sql,
  sourceDocumentId,
  fingerprint,
  resolution,
) {
  const resultMap = {
    matched: "match",
    ambiguous: "ambiguous",
    unmatched: "no_match",
    conflict: "conflict",
  };

  const checkResult =
    resultMap[resolution.status] ??
    resolution.status;

  const checkKey = stableFingerprint(
    "identity-resolution-er-v2",
    fingerprint,
    checkResult,
    resolution.entityId ?? "",
    resolution.score ?? "",
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
      ${resolution.entityId ?? null},
      'identity_resolution',
      'ER_V2',
      ${sourceDocumentId ?? null},
      ${checkResult},
      ${resolution.score ?? null},
      ${JSON.stringify({
        check_key: checkKey,
        observation_fingerprint:
          fingerprint,
        decision:
          resolution.decision,
        level:
          resolution.level,
        reasons:
          resolution.reasons,
      })}::jsonb
    WHERE NOT EXISTS (
      SELECT 1
      FROM cross_checks
      WHERE check_type =
        'identity_resolution'
        AND details ->> 'check_key' =
          ${checkKey}
    )
  `;
}

export async function observeAndResolvePerson(
  input,
  options = {},
) {
  const sql = options.sql ?? db();

  const resolution =
    await previewPersonObservation(
      input,
      { sql },
    );

  const identifiers =
    resolution.identifiers ?? [];

  const stableIdentifiers = [...identifiers]
    .sort((a, b) =>
      [
        a.type,
        a.normalizedValue,
        a.source ?? "",
      ]
        .join("|")
        .localeCompare(
          [
            b.type,
            b.normalizedValue,
            b.source ?? "",
          ].join("|"),
        ),
    );

  const fingerprint = stableFingerprint(
    input.sourceDocumentId ?? "",
    input.fullName ?? "",
    input.position ?? "",
    input.organization ?? "",
    input.city ?? "",
    JSON.stringify(stableIdentifiers),
  );

  const details = {
    decision: resolution.decision,
    hard_match: resolution.hardMatch,
    candidates:
      resolution.candidates?.slice(0, 5) ?? [],
    contradictions:
      resolution.contradictions ?? [],
  };

  const rows = await sql`
    INSERT INTO identity_observations (
      fingerprint,
      source_document_id,
      observed_entity_type,
      observed_name,
      observed_position,
      observed_organization,
      observed_city,
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
      ${input.sourceDocumentId ?? null},
      'person',
      ${input.fullName ?? null},
      ${input.position ?? null},
      ${input.organization ?? null},
      ${input.city ?? null},
      ${JSON.stringify(identifiers)}::jsonb,
      ${JSON.stringify({
        full_name:
          input.fullName ?? null,
        position:
          input.position ?? null,
        organization:
          input.organization ?? null,
        city:
          input.city ?? null,
      })}::jsonb,
      ${resolution.status},
      ${resolution.entityId ?? null},
      ${resolution.score ?? null},
      ${resolution.level ?? null},
      ${JSON.stringify(
        resolution.reasons ?? [],
      )}::jsonb,
      'er-v2',
      ${JSON.stringify(details)}::jsonb
    )

    ON CONFLICT (fingerprint)

    DO UPDATE SET
      source_document_id =
        EXCLUDED.source_document_id,
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
      resolver_version =
        EXCLUDED.resolver_version,
      details =
        COALESCE(
          identity_observations.details,
          '{}'::jsonb
        )
        ||
        EXCLUDED.details,
      updated_at = now()

    RETURNING id
  `;

  if (
    resolution.status === "matched" &&
    resolution.entityId
  ) {
    await registerHardIdentifiers(
      sql,
      resolution.entityId,
      identifiers,
      input.sourceDocumentId ?? null,
      fingerprint,
    );
  }

  await recordCrossCheck(
    sql,
    input.sourceDocumentId ?? null,
    fingerprint,
    resolution,
  );

  return {
    observationId: rows[0].id,
    fingerprint,
    ...resolution,
  };
}
