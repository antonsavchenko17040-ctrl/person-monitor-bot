const RESEARCH_STATUSES = new Set([
  "created",
  "identity_search",
  "identity_review",
  "collecting",
  "completed",
  "partial",
  "failed",
]);

const REFINEMENT_FIELDS = [
  "organization",
  "position",
  "city",
  "birthDate",
];

function text(value, maxLength = 240) {
  if (value == null) {
    return null;
  }

  const normalized = String(value)
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

export function parseJsonBody(request) {
  const body = request?.body;

  if (body == null || body === "") {
    return {};
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString("utf8"));
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  if (typeof body === "object" && !Array.isArray(body)) {
    return body;
  }

  throw new Error("INVALID_JSON_BODY");
}

export function normalizeBirthDate(value) {
  const normalized = text(value, 32);

  if (!normalized) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  return normalized;
}

export function normalizeResearchInput(input = {}) {
  const fullName = text(
    input.fullName ?? input.full_name,
    240,
  );

  if (!fullName || fullName.length < 3) {
    throw new Error("FULL_NAME_REQUIRED");
  }

  return {
    fullName,
    organization: text(input.organization),
    position: text(input.position),
    city: text(input.city),
    birthDate: normalizeBirthDate(
      input.birthDate ?? input.birth_date,
    ),
  };
}

export function normalizeRefinements(input = {}) {
  const result = {};

  for (const field of REFINEMENT_FIELDS) {
    if (field === "birthDate") {
      result[field] = normalizeBirthDate(
        input.birthDate ?? input.birth_date,
      );
    } else {
      result[field] = text(input[field]);
    }
  }

  return result;
}

function values(candidate, type) {
  return (candidate?.facts ?? [])
    .filter((item) => item?.type === type)
    .map((item) => text(item?.value))
    .filter(Boolean);
}

function first(valuesList) {
  return valuesList.find(Boolean) ?? null;
}

export function safeCandidate(candidate, score = {}) {
  const fullName = text(
    candidate?.canonical_name ?? score?.canonicalName,
  );

  return {
    candidateId: String(
      candidate?.id ?? score?.entityId ?? "",
    ),
    fullName,
    organization: first(values(candidate, "organization")),
    position: first(values(candidate, "position")),
    city: first(values(candidate, "city")),
    birthDate: first([
      ...values(candidate, "birth_date"),
      ...values(candidate, "date_of_birth"),
    ]),
    score: Number(score?.score ?? 0),
    level: String(score?.level ?? "rejected"),
    hardMatch: Boolean(score?.hardMatch),
    reasons: Array.isArray(score?.reasons)
      ? score.reasons.map((item) => text(item, 300)).filter(Boolean)
      : [],
  };
}

function uniqueOptions(candidates, field) {
  const seen = new Set();
  const result = [];

  for (const candidate of candidates) {
    const value = text(candidate?.[field]);
    const key = value?.toLocaleLowerCase("uk-UA");

    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result.sort((left, right) =>
    left.localeCompare(right, "uk-UA"),
  );
}

export function buildClarificationOptions(candidates = []) {
  return {
    organizations: uniqueOptions(candidates, "organization"),
    positions: uniqueOptions(candidates, "position"),
    cities: uniqueOptions(candidates, "city"),
    birthDates: uniqueOptions(candidates, "birthDate"),
  };
}

export function normalizeResearchRecord(row) {
  if (!row) {
    return null;
  }

  const status = RESEARCH_STATUSES.has(row.status)
    ? row.status
    : "failed";

  return {
    id: String(row.id),
    input: row.input_payload ?? {},
    status,
    identityStatus: row.identity_status ?? null,
    resolvedSubjectId: row.resolved_subject_id ?? null,
    candidates: Array.isArray(row.candidate_payload)
      ? row.candidate_payload
      : [],
    clarificationOptions:
      row.clarification_options ?? {},
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at ?? ""),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at ?? ""),
  };
}

export function isResearchValidationError(error) {
  return [
    "FULL_NAME_REQUIRED",
    "INVALID_BIRTH_DATE",
    "INVALID_JSON_BODY",
    "RESEARCH_REQUEST_ID_REQUIRED",
    "CANDIDATE_ID_REQUIRED",
    "INVALID_CANDIDATE_DECISION",
  ].includes(error?.message);
}
