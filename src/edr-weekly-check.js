export const EDR_WEEKLY_CHECK_MODE =
  "check-only";

export const EDR_FULL_IMPORT_GUARD =
  "full_import_disabled_until_storage_capacity_is_resolved";

function optionalText(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

export function buildEdrWeeklyCheck({
  discovered,
  activeSnapshot = null,
} = {}) {
  const discoveredVersion =
    optionalText(
      discovered?.version_key,
    );

  if (!discoveredVersion) {
    throw new TypeError(
      "discovered version_key is required",
    );
  }

  const activeVersion =
    optionalText(
      activeSnapshot?.version_key,
    );

  const updateAvailable =
    activeVersion !==
    discoveredVersion;

  let status =
    "up_to_date";

  if (!activeSnapshot) {
    status =
      "no_active_snapshot";
  } else if (updateAvailable) {
    status =
      "update_available";
  }

  return {
    mode:
      EDR_WEEKLY_CHECK_MODE,

    import_allowed:
      false,

    status,

    update_available:
      updateAvailable,

    dataset_id:
      optionalText(
        discovered?.dataset_id,
      ),

    discovered_version_key:
      discoveredVersion,

    discovered_modified_at:
      discovered
        ?.snapshot_modified_at ??
      discovered
        ?.metadata_modified ??
      null,

    active_snapshot_id:
      optionalText(
        activeSnapshot?.id,
      ),

    active_version_key:
      activeVersion,

    active_status:
      optionalText(
        activeSnapshot?.status,
      ),

    storage_guard:
      EDR_FULL_IMPORT_GUARD,
  };
}
