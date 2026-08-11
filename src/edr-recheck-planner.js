import {
  normalizeText,
} from "./utils.js";

export const EDR_RECHECK_VERSION =
  "edr-recheck-v1";

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function normalizeEdrpou(value) {
  const text =
    clean(value);

  if (!text) {
    return null;
  }

  let digits = "";

  for (const character of text) {
    if (
      character >= "0" &&
      character <= "9"
    ) {
      digits += character;
    }
  }

  return digits.length === 8
    ? digits
    : null;
}

function addReason(
  map,
  key,
  reason,
) {
  if (!key) {
    return;
  }

  const reasons =
    map.get(key) ??
    new Set();

  reasons.add(reason);

  map.set(
    key,
    reasons,
  );
}

function addRecordEdrpou(
  map,
  record,
  reason,
) {
  addReason(
    map,
    normalizeEdrpou(
      record?.edrpou,
    ),
    reason,
  );
}

function collectRecordSignals(
  recordComparison,
  edrpouReasons,
) {
  const organizations =
    recordComparison
      ?.organizations ?? {};

  for (
    const item
    of organizations.added ?? []
  ) {
    addRecordEdrpou(
      edrpouReasons,
      item?.record,
      "organization_added",
    );
  }

  for (
    const item
    of organizations.removed ?? []
  ) {
    addRecordEdrpou(
      edrpouReasons,
      item?.record,
      "organization_removed",
    );
  }

  for (
    const item
    of organizations.changed ?? []
  ) {
    addRecordEdrpou(
      edrpouReasons,
      item?.old_record,
      "organization_changed",
    );

    addRecordEdrpou(
      edrpouReasons,
      item?.new_record,
      "organization_changed",
    );
  }

  for (
    const item
    of organizations.ambiguous ?? []
  ) {
    for (
      const record
      of item?.old_records ?? []
    ) {
      addRecordEdrpou(
        edrpouReasons,
        record,
        "organization_ambiguous",
      );
    }

    for (
      const record
      of item?.new_records ?? []
    ) {
      addRecordEdrpou(
        edrpouReasons,
        record,
        "organization_ambiguous",
      );
    }
  }
}

function collectRelationItems(
  items,
  reason,
  edrpouReasons,
  nameReasons,
) {
  for (const item of items ?? []) {
    for (
      const observation
      of item?.observations ?? []
    ) {
      addReason(
        edrpouReasons,
        normalizeEdrpou(
          observation
            ?.record_edrpou,
        ),
        reason,
      );

      const normalizedName =
        normalizeText(
          observation
            ?.normalized_value ??
          observation
            ?.value_text ??
          "",
        );

      if (normalizedName) {
        addReason(
          nameReasons,
          normalizedName,
          reason,
        );
      }
    }
  }
}

function mapReasons(map, keyName) {
  return [...map.entries()]
    .map(
      ([key, reasons]) => ({
        [keyName]:
          key,

        reasons:
          [...reasons].sort(),
      }),
    )
    .sort(
      (left, right) =>
        String(
          left[keyName],
        ).localeCompare(
          String(
            right[keyName],
          ),
          "uk-UA",
        ),
    );
}

export function
buildEdrRecheckSignals({
  recordComparison = null,
  relationComparison = null,
} = {}) {
  const edrpouReasons =
    new Map();

  const nameReasons =
    new Map();

  collectRecordSignals(
    recordComparison,
    edrpouReasons,
  );

  const relationDiff =
    relationComparison
      ?.comparison ??
    relationComparison ??
    {};

  collectRelationItems(
    relationDiff.added,
    "relation_added",
    edrpouReasons,
    nameReasons,
  );

  collectRelationItems(
    relationDiff.removed,
    "relation_removed",
    edrpouReasons,
    nameReasons,
  );

  return {
    version:
      EDR_RECHECK_VERSION,

    organizations:
      mapReasons(
        edrpouReasons,
        "edrpou",
      ),

    names:
      mapReasons(
        nameReasons,
        "normalized_name",
      ),
  };
}

function requireSql(sql) {
  if (
    typeof sql !==
      "function"
  ) {
    throw new TypeError(
      "sql must be a tagged-template function",
    );
  }

  return sql;
}

export async function
loadEnabledSubjectsForEdrRecheck(
  sql,
) {
  requireSql(sql);

  return sql`
    SELECT
      id,
      entity_id,
      full_name,
      aliases,
      organization,
      position,
      city
    FROM subjects
    WHERE enabled = true
    ORDER BY created_at ASC
  `;
}

export async function
loadExistingEdrSubjectLinks(
  sql,
) {
  requireSql(sql);

  return sql`
    SELECT DISTINCT
      subject.id
        AS subject_id,

      subject.entity_id
        AS subject_entity_id,

      identifier.normalized_value
        AS edrpou

    FROM subjects
      AS subject

    JOIN relations
      AS relation
      ON relation.from_entity_id =
        subject.entity_id

    JOIN entity_identifiers
      AS identifier
      ON identifier.entity_id =
        relation.to_entity_id

    WHERE
      subject.enabled = true

      AND relation.metadata
        ->> ${"source"} =
        ${"edr"}

      AND identifier.identifier_type =
        ${"edrpou"}
  `;
}

function subjectNames(subject) {
  const names =
    new Set();

  const fullName =
    normalizeText(
      subject?.full_name,
    );

  if (fullName) {
    names.add(fullName);
  }

  for (
    const alias
    of Array.isArray(
      subject?.aliases,
    )
      ? subject.aliases
      : []
  ) {
    const normalized =
      normalizeText(alias);

    if (normalized) {
      names.add(normalized);
    }
  }

  return names;
}

function ensureResultEntry(
  map,
  subject,
) {
  const existing =
    map.get(
      String(subject.id),
    );

  if (existing) {
    return existing;
  }

  const entry = {
    id:
      subject.id,

    entity_id:
      subject.entity_id ?? null,

    full_name:
      subject.full_name,

    organization:
      subject.organization ?? null,

    position:
      subject.position ?? null,

    city:
      subject.city ?? null,

    reasons:
      new Set(),

    matched_names:
      new Set(),

    matched_edrpous:
      new Set(),
  };

  map.set(
    String(subject.id),
    entry,
  );

  return entry;
}

export async function
findSubjectsForEdrRecheck(
  sql,
  {
    recordComparison = null,
    relationComparison = null,
  } = {},
) {
  requireSql(sql);

  const signals =
    buildEdrRecheckSignals({
      recordComparison,
      relationComparison,
    });

  if (
    !signals.organizations.length &&
    !signals.names.length
  ) {
    return {
      version:
        EDR_RECHECK_VERSION,

      strategy:
        "exact_subject_name_or_existing_edr_graph_link",

      signals,

      subjects: [],

      summary: {
        subjects: 0,
        exact_name_matches: 0,
        existing_graph_matches: 0,
      },
    };
  }

  const subjects =
    await loadEnabledSubjectsForEdrRecheck(
      sql,
    );

  const subjectMap =
    new Map(
      subjects.map(
        (subject) => [
          String(subject.id),
          subject,
        ],
      ),
    );

  const result =
    new Map();

  const nameSignalMap =
    new Map(
      signals.names.map(
        (signal) => [
          signal.normalized_name,
          signal,
        ],
      ),
    );

  let exactNameMatches = 0;

  for (const subject of subjects) {
    for (
      const name
      of subjectNames(subject)
    ) {
      const signal =
        nameSignalMap.get(name);

      if (!signal) {
        continue;
      }

      const entry =
        ensureResultEntry(
          result,
          subject,
        );

      entry.reasons.add(
        "exact_subject_name_match",
      );

      for (
        const reason
        of signal.reasons
      ) {
        entry.reasons.add(
          reason,
        );
      }

      entry.matched_names.add(
        name,
      );

      exactNameMatches += 1;

      break;
    }
  }

  const organizationSignalMap =
    new Map(
      signals.organizations.map(
        (signal) => [
          signal.edrpou,
          signal,
        ],
      ),
    );

  let existingGraphMatches = 0;

  if (
    organizationSignalMap.size
  ) {
    const links =
      await loadExistingEdrSubjectLinks(
        sql,
      );

    for (const link of links) {
      const edrpou =
        normalizeEdrpou(
          link?.edrpou,
        );

      const signal =
        organizationSignalMap.get(
          edrpou,
        );

      if (!signal) {
        continue;
      }

      const subject =
        subjectMap.get(
          String(
            link.subject_id,
          ),
        );

      if (!subject) {
        continue;
      }

      const entry =
        ensureResultEntry(
          result,
          subject,
        );

      entry.reasons.add(
        "existing_edr_graph_link",
      );

      for (
        const reason
        of signal.reasons
      ) {
        entry.reasons.add(
          reason,
        );
      }

      entry.matched_edrpous.add(
        edrpou,
      );

      existingGraphMatches += 1;
    }
  }

  const resultSubjects =
    [...result.values()]
      .map(
        (entry) => ({
          ...entry,

          reasons:
            [...entry.reasons]
              .sort(),

          matched_names:
            [...entry.matched_names]
              .sort(),

          matched_edrpous:
            [...entry.matched_edrpous]
              .sort(),
        }),
      )
      .sort(
        (left, right) =>
          String(
            left.full_name,
          ).localeCompare(
            String(
              right.full_name,
            ),
            "uk-UA",
          ),
      );

  return {
    version:
      EDR_RECHECK_VERSION,

    strategy:
      "exact_subject_name_or_existing_edr_graph_link",

    signals,

    subjects:
      resultSubjects,

    summary: {
      subjects:
        resultSubjects.length,

      exact_name_matches:
        exactNameMatches,

      existing_graph_matches:
        existingGraphMatches,
    },
  };
}
