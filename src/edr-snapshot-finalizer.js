import {
  validateEdrSnapshotCounts,
} from "./edr-snapshot-validator.js";

import {
  markEdrSnapshotReady,
  activateEdrSnapshot,
} from "./edr-snapshot-store.js";

function requiredText(
  value,
  field,
) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return text;
}

function requiredFunction(
  value,
  field,
) {
  if (
    typeof value !==
    "function"
  ) {
    throw new TypeError(
      `${field} must be a function`,
    );
  }

  return value;
}

export async function
finalizeEdrSnapshot(
  sql,
  {
    snapshotId,
    organizationCount,
    fopCount,
    relationCount,

    validateSnapshot =
      validateEdrSnapshotCounts,

    markReady =
      markEdrSnapshotReady,

    activateSnapshot =
      activateEdrSnapshot,
  } = {},
) {
  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const validator =
    requiredFunction(
      validateSnapshot,
      "validateSnapshot",
    );

  const readyMarker =
    requiredFunction(
      markReady,
      "markReady",
    );

  const activator =
    requiredFunction(
      activateSnapshot,
      "activateSnapshot",
    );

  const validation =
    await validator(
      sql,
      {
        snapshotId:
          normalizedSnapshotId,

        organizationCount,
        fopCount,
        relationCount,
      },
    );

  if (
    !validation ||
    validation.ok !== true
  ) {
    throw new Error(
      "EDR snapshot validation did not succeed",
    );
  }

  const readySnapshot =
    await readyMarker(
      sql,
      {
        snapshotId:
          normalizedSnapshotId,

        organizationCount:
          validation.organization_count,

        fopCount:
          validation.fop_count,

        relationCount:
          validation.relation_count,
      },
    );

  const activation =
    await activator(
      sql,
      {
        snapshotId:
          normalizedSnapshotId,
      },
    );

  return {
    validation,
    ready_snapshot:
      readySnapshot,
    activation,
  };
}
