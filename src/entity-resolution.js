import { db } from "./db.js";
import { normalizeText } from "./utils.js";

const GUID_TYPES = new Set([
  "guid",
  "person_guid",
  "nazk_guid",
  "external_guid",
]);

function normalizeGuid(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[{}]/g, "");
}

function tokens(value) {
  return [...new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter(Boolean)
  )];
}

function tokenSignature(value) {
  return tokens(value).sort().join("|");
}

export function textSimilarity(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));

  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;

  for (const value of a) {
    if (b.has(value)) {
      intersection += 1;
    }
  }

  const union = new Set([...a, ...b]).size;

  return union ? intersection / union : 0;
}

function normalizedEquals(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);

  return Boolean(a && b && a === b);
}

function sameNameTokens(left, right) {
  const a = tokenSignature(left);
  const b = tokenSignature(right);

  return Boolean(a && b && a === b);
}

function identifierValues(candidate, types) {
  const allowed = new Set(
    Array.isArray(types) ? types : [types]
  );

  return (candidate.identifiers ?? [])
    .filter((item) => allowed.has(item.type))
    .map((item) => item.value)
    .filter(Boolean);
}

function factValues(candidate, type) {
  return (candidate.facts ?? [])
    .filter((item) => item.type === type)
    .map((item) => item.value)
    .filter(Boolean);
}

function bestSimilarity(input, values) {
  if (!input || !values?.length) {
    return 0;
  }

  let best = 0;

  for (const value of values) {
    if (normalizedEquals(input, value)) {
      return 1;
    }

    best = Math.max(best, textSimilarity(input, value));
  }

  return best;
}

function classify(score) {
  if (score >= 85) {
    return "confirmed";
  }

  if (score >= 70) {
    return "probable";
  }

  if (score >= 55) {
    return "possible";
  }

  return "rejected";
}

export function scorePersonCandidate(input, candidate) {
  const reasons = [];

  const suppliedGuid = normalizeGuid(input.guid);

  const candidateGuids = (candidate.identifiers ?? [])
    .filter((item) => GUID_TYPES.has(item.type))
    .map((item) => normalizeGuid(item.value))
    .filter(Boolean);

  if (suppliedGuid && candidateGuids.includes(suppliedGuid)) {
    return {
      entityId: candidate.id,
      canonicalName: candidate.canonical_name,
      score: 100,
      level: "confirmed",
      hardMatch: true,
      reasons: [
        "Точний збіг GUID",
      ],
    };
  }

  if (
    suppliedGuid &&
    candidateGuids.length > 0 &&
    !candidateGuids.includes(suppliedGuid)
  ) {
    return {
      entityId: candidate.id,
      canonicalName: candidate.canonical_name,
      score: 0,
      level: "rejected",
      hardMatch: false,
      reasons: [
        "GUID суперечить GUID кандидата",
      ],
    };
  }

  let score = 0;

  /*
   * NAME: максимум 70
   *
   * exact full name / canonical name = 70
   * exact alias = 65
   * fuzzy name = до 60
   */

  const fullNames = [
    candidate.canonical_name,
    ...identifierValues(candidate, "full_name"),
  ].filter(Boolean);

  const aliases = identifierValues(candidate, "alias");

  const exactFullName = fullNames.some(
    (value) =>
      normalizedEquals(input.fullName, value) ||
      sameNameTokens(input.fullName, value),
  );

  const exactAlias = aliases.some(
    (value) =>
      normalizedEquals(input.fullName, value) ||
      sameNameTokens(input.fullName, value),
  );

  let nameScore = 0;

  if (input.fullName && exactFullName) {
    nameScore = 70;
    reasons.push("Точний збіг ПІБ");
  } else if (input.fullName && exactAlias) {
    nameScore = 65;
    reasons.push("ПІБ збігається з alias");
  } else if (input.fullName) {
    const similarity = Math.max(
      bestSimilarity(input.fullName, fullNames),
      bestSimilarity(input.fullName, aliases),
    );

    nameScore = Math.round(similarity * 60);

    if (nameScore > 0) {
      reasons.push(
        `Схожість ПІБ: ${Math.round(similarity * 100)}%`,
      );
    }
  }

  score += nameScore;

  /*
   * POSITION: максимум 15
   */

  if (input.position) {
    const similarity = bestSimilarity(
      input.position,
      factValues(candidate, "position"),
    );

    const points = Math.round(similarity * 15);
    score += points;

    if (points > 0) {
      reasons.push(
        `Збіг посади: ${Math.round(similarity * 100)}%`,
      );
    }
  }

  /*
   * ORGANIZATION: максимум 10
   */

  if (input.organization) {
    const similarity = bestSimilarity(
      input.organization,
      factValues(candidate, "organization"),
    );

    const points = Math.round(similarity * 10);
    score += points;

    if (points > 0) {
      reasons.push(
        `Збіг організації: ${Math.round(similarity * 100)}%`,
      );
    }
  }

  /*
   * CITY: максимум 5
   */

  if (input.city) {
    const similarity = bestSimilarity(
      input.city,
      factValues(candidate, "city"),
    );

    const points = Math.round(similarity * 5);
    score += points;

    if (points > 0) {
      reasons.push(
        `Збіг міста: ${Math.round(similarity * 100)}%`,
      );
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    entityId: candidate.id,
    canonicalName: candidate.canonical_name,
    score,
    level: classify(score),
    hardMatch: false,
    reasons,
  };
}

export function resolvePersonFromCandidates(input, candidates) {
  const scored = candidates
    .map((candidate) => scorePersonCandidate(input, candidate))
    .sort((a, b) => b.score - a.score);

  const best = scored[0] ?? null;
  const second = scored[1] ?? null;

  /*
   * Якщо дві різні особи мають практично однаковий score,
   * не вважаємо збіг безумовним.
   */
  if (
    best &&
    second &&
    !best.hardMatch &&
    best.level === "confirmed" &&
    best.score - second.score < 5
  ) {
    best.level = "probable";
    best.reasons = [
      ...best.reasons,
      "Є інший кандидат із близьким score",
    ];
  }

  return {
    best,
    candidates: scored,
  };
}

export async function loadPersonCandidates(sql = db()) {
  const rows = await sql`
    SELECT
      e.id,
      e.canonical_name,

      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'type', ei.identifier_type,
            'value', ei.identifier_value,
            'normalized', ei.normalized_value,
            'source', ei.source,
            'confidence', ei.confidence
          )
        ) FILTER (
          WHERE ei.id IS NOT NULL
        ),
        '[]'::jsonb
      ) AS identifiers,

      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'type', f.fact_type,
            'value', f.value_text,
            'confidence', f.confidence,
            'status', f.verification_status
          )
        ) FILTER (
          WHERE f.id IS NOT NULL
        ),
        '[]'::jsonb
      ) AS facts

    FROM entities e

    LEFT JOIN entity_identifiers ei
      ON ei.entity_id = e.id

    LEFT JOIN facts f
      ON f.entity_id = e.id

    WHERE e.entity_type = 'person'
      AND e.status = 'active'

    GROUP BY
      e.id,
      e.canonical_name

    ORDER BY e.canonical_name
  `;

  return rows;
}

export async function resolvePersonIdentity(input, options = {}) {
  const sql = options.sql ?? db();

  const candidates = await loadPersonCandidates(sql);

  return resolvePersonFromCandidates(
    {
      fullName: input.fullName ?? null,
      position: input.position ?? null,
      organization: input.organization ?? null,
      city: input.city ?? null,
      guid: input.guid ?? null,
    },
    candidates,
  );
}
