export const EDR_SNAPSHOT_DIFF_VERSION =
  "edr-snapshot-diff-v1";

function optionalText(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function normalizeEdrpou(value) {
  const digits =
    String(value ?? "")
      .replace(/\D/g, "");

  return digits.length === 8
    ? digits
    : null;
}

function contentHash(record) {
  const hash =
    optionalText(
      record?.content_hash,
    );

  if (!hash) {
    throw new TypeError(
      "content_hash is required for snapshot comparison",
    );
  }

  return hash;
}

function recordView(record) {
  return {
    id:
      record?.id ?? null,

    snapshot_id:
      record?.snapshot_id ?? null,

    record_type:
      record?.record_type ?? null,

    record_number:
      record?.record_number ?? null,

    source_sequence:
      record?.source_sequence ?? null,

    name:
      record?.name ?? null,

    edrpou:
      record?.edrpou ?? null,

    content_hash:
      record?.content_hash ?? null,
  };
}

export function organizationSnapshotKey(
  record,
) {
  if (
    record?.record_type !==
      "organization"
  ) {
    return null;
  }

  const edrpou =
    normalizeEdrpou(
      record?.edrpou,
    );

  if (!edrpou) {
    return null;
  }

  return (
    "organization:edrpou:" +
    edrpou
  );
}

function groupOrganizations(
  records,
) {
  const groups =
    new Map();

  const unkeyed = [];

  for (const record of records) {
    if (
      record?.record_type !==
        "organization"
    ) {
      continue;
    }

    const key =
      organizationSnapshotKey(
        record,
      );

    if (!key) {
      unkeyed.push(
        recordView(record),
      );
      continue;
    }

    const group =
      groups.get(key) ?? [];

    group.push(record);

    groups.set(
      key,
      group,
    );
  }

  return {
    groups,
    unkeyed,
  };
}

export function compareEdrOrganizationRecords(
  oldRecords = [],
  newRecords = [],
) {
  const oldState =
    groupOrganizations(
      oldRecords,
    );

  const newState =
    groupOrganizations(
      newRecords,
    );

  const keys =
    [
      ...new Set([
        ...oldState.groups.keys(),
        ...newState.groups.keys(),
      ]),
    ].sort();

  const result = {
    identity_strategy:
      "edrpou",

    added: [],
    removed: [],
    changed: [],
    unchanged: [],
    ambiguous: [],

    unkeyed_old:
      oldState.unkeyed,

    unkeyed_new:
      newState.unkeyed,
  };

  for (const key of keys) {
    const oldGroup =
      oldState.groups.get(key) ??
      [];

    const newGroup =
      newState.groups.get(key) ??
      [];

    if (
      oldGroup.length > 1 ||
      newGroup.length > 1
    ) {
      result.ambiguous.push({
        key,
        reason:
          "duplicate_stable_identifier",

        old_records:
          oldGroup.map(
            recordView,
          ),

        new_records:
          newGroup.map(
            recordView,
          ),
      });

      continue;
    }

    const oldRecord =
      oldGroup[0] ?? null;

    const newRecord =
      newGroup[0] ?? null;

    if (!oldRecord) {
      result.added.push({
        key,
        record:
          recordView(
            newRecord,
          ),
      });

      continue;
    }

    if (!newRecord) {
      result.removed.push({
        key,
        record:
          recordView(
            oldRecord,
          ),
      });

      continue;
    }

    const oldHash =
      contentHash(
        oldRecord,
      );

    const newHash =
      contentHash(
        newRecord,
      );

    if (oldHash === newHash) {
      result.unchanged.push({
        key,
        record:
          recordView(
            newRecord,
          ),
      });

      continue;
    }

    result.changed.push({
      key,

      old_record:
        recordView(
          oldRecord,
        ),

      new_record:
        recordView(
          newRecord,
        ),
    });
  }

  result.summary = {
    added:
      result.added.length,

    removed:
      result.removed.length,

    changed:
      result.changed.length,

    unchanged:
      result.unchanged.length,

    ambiguous:
      result.ambiguous.length,

    unkeyed_old:
      result.unkeyed_old.length,

    unkeyed_new:
      result.unkeyed_new.length,
  };

  return result;
}

function groupFopByHash(
  records,
) {
  const groups =
    new Map();

  for (const record of records) {
    if (
      record?.record_type !==
        "fop"
    ) {
      continue;
    }

    const hash =
      contentHash(record);

    const group =
      groups.get(hash) ?? [];

    group.push(record);

    groups.set(
      hash,
      group,
    );
  }

  return groups;
}

export function compareEdrFopObservations(
  oldRecords = [],
  newRecords = [],
) {
  const oldGroups =
    groupFopByHash(
      oldRecords,
    );

  const newGroups =
    groupFopByHash(
      newRecords,
    );

  const hashes =
    [
      ...new Set([
        ...oldGroups.keys(),
        ...newGroups.keys(),
      ]),
    ].sort();

  const result = {
    identity_strategy:
      "content_hash_multiset",

    identity_warning:
      "FOP records are not linked across snapshots without a stable identifier",

    added_observations: [],
    removed_observations: [],

    unchanged_count: 0,

    changed: [],
  };

  for (const hash of hashes) {
    const oldGroup =
      oldGroups.get(hash) ??
      [];

    const newGroup =
      newGroups.get(hash) ??
      [];

    const shared =
      Math.min(
        oldGroup.length,
        newGroup.length,
      );

    result.unchanged_count +=
      shared;

    if (
      newGroup.length >
      shared
    ) {
      result.added_observations.push({
        content_hash:
          hash,

        count:
          newGroup.length -
          shared,

        records:
          newGroup
            .slice(shared)
            .map(recordView),
      });
    }

    if (
      oldGroup.length >
      shared
    ) {
      result.removed_observations.push({
        content_hash:
          hash,

        count:
          oldGroup.length -
          shared,

        records:
          oldGroup
            .slice(shared)
            .map(recordView),
      });
    }
  }

  result.summary = {
    added_observations:
      result.added_observations
        .reduce(
          (sum, item) =>
            sum + item.count,
          0,
        ),

    removed_observations:
      result.removed_observations
        .reduce(
          (sum, item) =>
            sum + item.count,
          0,
        ),

    unchanged:
      result.unchanged_count,

    changed:
      0,
  };

  return result;
}

export function compareEdrSnapshotRecords({
  oldRecords = [],
  newRecords = [],
} = {}) {
  const organizations =
    compareEdrOrganizationRecords(
      oldRecords,
      newRecords,
    );

  const fop =
    compareEdrFopObservations(
      oldRecords,
      newRecords,
    );

  return {
    version:
      EDR_SNAPSHOT_DIFF_VERSION,

    organizations,
    fop,

    summary: {
      organization_changes:
        organizations.summary.added +
        organizations.summary.removed +
        organizations.summary.changed,

      organization_ambiguous:
        organizations.summary.ambiguous,

      fop_added_observations:
        fop.summary
          .added_observations,

      fop_removed_observations:
        fop.summary
          .removed_observations,
    },
  };
}
