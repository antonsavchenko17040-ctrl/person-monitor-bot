import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_WEEKLY_CHECK_MODE,
  EDR_FULL_IMPORT_GUARD,
  buildEdrWeeklyCheck,
} from "../src/edr-weekly-check.js";

function discovered(
  overrides = {},
) {
  return {
    dataset_id:
      "dataset-1",

    version_key:
      "version-2",

    snapshot_modified_at:
      "2026-08-04T07:48:54.903Z",

    ...overrides,
  };
}

test("exports safe weekly check constants", () => {
  assert.equal(
    EDR_WEEKLY_CHECK_MODE,
    "check-only",
  );

  assert.equal(
    EDR_FULL_IMPORT_GUARD,
    "full_import_disabled_until_storage_capacity_is_resolved",
  );
});

test("requires discovered version key", () => {
  assert.throws(
    () =>
      buildEdrWeeklyCheck({
        discovered: {},
      }),
    /discovered version_key is required/,
  );
});

test("reports update when no active snapshot exists", () => {
  const result =
    buildEdrWeeklyCheck({
      discovered:
        discovered(),
    });

  assert.equal(
    result.status,
    "no_active_snapshot",
  );

  assert.equal(
    result.update_available,
    true,
  );

  assert.equal(
    result.import_allowed,
    false,
  );

  assert.equal(
    result.active_snapshot_id,
    null,
  );
});

test("reports active snapshot as up to date", () => {
  const result =
    buildEdrWeeklyCheck({
      discovered:
        discovered(),
      activeSnapshot: {
        id: "snapshot-1",
        version_key:
          "version-2",
        status: "ready",
      },
    });

  assert.equal(
    result.status,
    "up_to_date",
  );

  assert.equal(
    result.update_available,
    false,
  );

  assert.equal(
    result.active_snapshot_id,
    "snapshot-1",
  );

  assert.equal(
    result.active_status,
    "ready",
  );
});

test("detects a newer official dataset version", () => {
  const result =
    buildEdrWeeklyCheck({
      discovered:
        discovered(),
      activeSnapshot: {
        id: "snapshot-1",
        version_key:
          "version-1",
        status: "ready",
      },
    });

  assert.equal(
    result.status,
    "update_available",
  );

  assert.equal(
    result.update_available,
    true,
  );

  assert.equal(
    result.discovered_version_key,
    "version-2",
  );

  assert.equal(
    result.active_version_key,
    "version-1",
  );

  assert.equal(
    result.import_allowed,
    false,
  );
});
