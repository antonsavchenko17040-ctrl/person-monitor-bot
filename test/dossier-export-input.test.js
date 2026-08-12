import test from "node:test";
import assert from "node:assert/strict";

import {
  DOSSIER_EXPORT_INPUT_VERSION,
  loadDossierExportInput,
  normalizeDossierExportInput,
} from "../src/dossier-export-input.js";

const VERSION_ID =
  "11111111-1111-4111-8111-111111111111";

const SUBJECT_ID =
  "22222222-2222-4222-8222-222222222222";

function fixture(
  overrides = {}
) {
  return {
    id:
      VERSION_ID,

    subject_id:
      SUBJECT_ID,

    dossier_status:
      "completed",

    report_schema_version:
      "report-model-v1",

    report_generated_at:
      "2026-08-12T10:00:00.000Z",

    report_payload_hash:
      "abc123",

    report_payload_hash_version:
      "canonical-json-sha256-v1",

    created_at:
      "2026-08-12T10:01:00.000Z",

    report_payload: {
      schema_version:
        "report-model-v1",

      generated_at:
        "2026-08-12T10:00:00.000Z",

      subject: {
        id:
          SUBJECT_ID,

        full_name:
          "Тестовий Суб’єкт",
      },
    },

    ...overrides,
  };
}

test(
  "normalizes immutable dossier export input",
  () => {
    const result =
      normalizeDossierExportInput(
        fixture()
      );

    assert.equal(
      result.contract_version,
      DOSSIER_EXPORT_INPUT_VERSION
    );

    assert.equal(
      result.dossier_version_id,
      VERSION_ID
    );

    assert.equal(
      result.subject_id,
      SUBJECT_ID
    );

    assert.equal(
      result.report_schema_version,
      "report-model-v1"
    );

    assert.equal(
      result.report_payload_hash,
      "abc123"
    );

    assert.equal(
      result.report.subject.full_name,
      "Тестовий Суб’єкт"
    );
  }
);

test(
  "loads exact persisted dossier version",
  async () => {
    let received = null;

    const result =
      await loadDossierExportInput(
        {
          dossierVersionId:
            VERSION_ID,
        },
        {
          loadById:
            async (input) => {
              received =
                input;

              return fixture();
            },
        }
      );

    assert.deepEqual(
      received,
      {
        dossierVersionId:
          VERSION_ID,
      }
    );

    assert.equal(
      result.dossier_version_id,
      VERSION_ID
    );
  }
);

test(
  "returns null when persisted dossier version is absent",
  async () => {
    const result =
      await loadDossierExportInput(
        {
          dossierVersionId:
            VERSION_ID,
        },
        {
          loadById:
            async () =>
              null,
        }
      );

    assert.equal(
      result,
      null
    );
  }
);

test(
  "rejects missing canonical report payload",
  () => {
    assert.throws(
      () =>
        normalizeDossierExportInput(
          fixture({
            report_payload:
              null,
          })
        ),
      /canonical report payload/
    );
  }
);

test(
  "rejects persisted subject mismatch",
  () => {
    assert.throws(
      () =>
        normalizeDossierExportInput(
          fixture({
            report_payload: {
              schema_version:
                "report-model-v1",

              subject: {
                id:
                  "33333333-3333-4333-8333-333333333333",
              },
            },
          })
        ),
      /subject mismatch/
    );
  }
);
