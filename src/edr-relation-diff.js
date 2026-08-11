export const EDR_RELATION_DIFF_VERSION =
  "edr-relation-diff-v1";

export const EDR_SUBJECT_RELATION_TYPES =
  Object.freeze([
    "founder",
    "beneficiary",
    "signer",
    "member",
    "executive_power",
    "superior_management",
  ]);

const SUPPORTED_TYPES =
  new Set(
    EDR_SUBJECT_RELATION_TYPES,
  );

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function normalizeCode(value) {
  const result =
    clean(value);

  return result
    ? result.toLowerCase()
    : null;
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

function relationView(row) {
  return {
    id:
      row?.id ?? null,

    snapshot_id:
      row?.snapshot_id ?? null,

    record_id:
      row?.record_id ?? null,

    relation_type:
      row?.relation_type ?? null,

    ordinal:
      row?.ordinal ?? null,

    value_text:
      row?.value_text ?? null,

    normalized_value:
      row?.normalized_value ?? null,

    value_code:
      row?.value_code ?? null,

    record_type:
      row?.record_type ?? null,

    record_name:
      row?.record_name ?? null,

    record_edrpou:
      row?.record_edrpou ?? null,
  };
}

export function
edrRelationObservationKey(
  row,
) {
  const relationType =
    clean(
      row?.relation_type,
    );

  if (
    !SUPPORTED_TYPES.has(
      relationType,
    )
  ) {
    return null;
  }

  if (
    row?.record_type !==
      "organization"
  ) {
    return null;
  }

  const edrpou =
    normalizeEdrpou(
      row?.record_edrpou,
    );

  if (!edrpou) {
    return null;
  }

  const code =
    normalizeCode(
      row?.value_code,
    );

  const text =
    clean(
      row?.normalized_value,
    );

  const target =
    code
      ? "code:" + code
      : text
        ? "text:" + text
        : null;

  if (!target) {
    return null;
  }

  return [
    "organization:edrpou:" +
      edrpou,
    relationType,
    target,
  ].join("|");
}

function classifyRows(rows) {
  const groups =
    new Map();

  const unsupported = [];
  const unkeyed = [];

  for (const row of rows) {
    const relationType =
      clean(
        row?.relation_type,
      );

    if (
      !SUPPORTED_TYPES.has(
        relationType,
      )
    ) {
      unsupported.push(
        relationView(row),
      );

      continue;
    }

    const key =
      edrRelationObservationKey(
        row,
      );

    if (!key) {
      unkeyed.push(
        relationView(row),
      );

      continue;
    }

    const group =
      groups.get(key) ?? [];

    group.push(row);

    groups.set(
      key,
      group,
    );
  }

  return {
    groups,
    unsupported,
    unkeyed,
  };
}

export function
compareEdrRelationObservations(
  oldRows = [],
  newRows = [],
) {
  const oldState =
    classifyRows(
      oldRows,
    );

  const newState =
    classifyRows(
      newRows,
    );

  const keys =
    [
      ...new Set([
        ...oldState.groups.keys(),
        ...newState.groups.keys(),
      ]),
    ].sort();

  const result = {
    version:
      EDR_RELATION_DIFF_VERSION,

    identity_strategy:
      "organization_edrpou_relation_type_exact_target",

    added: [],
    removed: [],
    unchanged: [],

    unkeyed_old:
      oldState.unkeyed,

    unkeyed_new:
      newState.unkeyed,

    unsupported_old:
      oldState.unsupported,

    unsupported_new:
      newState.unsupported,
  };

  for (const key of keys) {
    const oldGroup =
      oldState.groups.get(key) ??
      [];

    const newGroup =
      newState.groups.get(key) ??
      [];

    const shared =
      Math.min(
        oldGroup.length,
        newGroup.length,
      );

    if (shared > 0) {
      result.unchanged.push({
        key,
        count:
          shared,
        observations:
          newGroup
            .slice(0, shared)
            .map(
              relationView,
            ),
      });
    }

    if (
      newGroup.length >
        shared
    ) {
      result.added.push({
        key,
        count:
          newGroup.length -
          shared,
        observations:
          newGroup
            .slice(shared)
            .map(
              relationView,
            ),
      });
    }

    if (
      oldGroup.length >
        shared
    ) {
      result.removed.push({
        key,
        count:
          oldGroup.length -
          shared,
        observations:
          oldGroup
            .slice(shared)
            .map(
              relationView,
            ),
      });
    }
  }

  const count =
    (items) =>
      items.reduce(
        (sum, item) =>
          sum + item.count,
        0,
      );

  result.summary = {
    added:
      count(result.added),

    removed:
      count(result.removed),

    unchanged:
      count(result.unchanged),

    unkeyed_old:
      result.unkeyed_old.length,

    unkeyed_new:
      result.unkeyed_new.length,

    unsupported_old:
      result.unsupported_old.length,

    unsupported_new:
      result.unsupported_new.length,
  };

  return result;
}
