import {
  loadDossierVersionById,
} from "./dossier-version-store.js";

export const DOSSIER_EXPORT_INPUT_VERSION =
  "dossier-export-input-v1";

function isRecord(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export function normalizeDossierExportInput(
  dossierVersion
) {
  if (!isRecord(dossierVersion)) {
    throw new TypeError(
      "dossierVersion is required"
    );
  }

  const versionId =
    String(
      dossierVersion.id ??
      ""
    ).trim();

  const subjectId =
    String(
      dossierVersion.subject_id ??
      ""
    ).trim();

  if (
    !versionId ||
    !subjectId
  ) {
    throw new Error(
      "Persisted dossier version is missing identity metadata"
    );
  }

  const report =
    dossierVersion.report_payload;

  if (!isRecord(report)) {
    throw new Error(
      "Persisted dossier version has no canonical report payload"
    );
  }

  const reportSubjectId =
    String(
      report.subject?.id ??
      ""
    ).trim();

  if (
    reportSubjectId &&
    reportSubjectId !==
      subjectId
  ) {
    throw new Error(
      "Persisted dossier subject mismatch"
    );
  }

  return {
    contract_version:
      DOSSIER_EXPORT_INPUT_VERSION,

    dossier_version_id:
      versionId,

    subject_id:
      subjectId,

    dossier_status:
      dossierVersion.dossier_status ??
      null,

    report_schema_version:
      dossierVersion
        .report_schema_version ??
      report.schema_version ??
      null,

    report_generated_at:
      dossierVersion
        .report_generated_at ??
      report.generated_at ??
      null,

    report_payload_hash:
      dossierVersion
        .report_payload_hash ??
      null,

    report_payload_hash_version:
      dossierVersion
        .report_payload_hash_version ??
      null,

    created_at:
      dossierVersion.created_at ??
      null,

    report,
  };
}

export async function loadDossierExportInput(
  {
    dossierVersionId,
  } = {},
  options = {},
) {
  const loadById =
    options.loadById ??
    loadDossierVersionById;

  const dossierVersion =
    await loadById({
      dossierVersionId,
    });

  if (!dossierVersion) {
    return null;
  }

  return normalizeDossierExportInput(
    dossierVersion
  );
}
