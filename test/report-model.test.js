import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_MODEL_LIMITATIONS,
  REPORT_MODEL_SCHEMA_VERSION,
  buildSubjectReportModel,
  buildSubjectReportModelPayload,
} from "../src/report-model.js";

const SUBJECT = {
  id:
    "00000000-0000-4000-8000-000000000001",

  entity_id:
    "00000000-0000-4000-8000-000000000002",

  full_name:
    "Тестова Особа",

  organization:
    "Тестова організація",

  position:
    "Тестова посада",

  city:
    "Київ",
};

test(
  "report model exports canonical V1 builders",
  () => {
    assert.equal(
      REPORT_MODEL_SCHEMA_VERSION,
      "report-model-v1",
    );

    assert.ok(
      Array.isArray(
        REPORT_MODEL_LIMITATIONS,
      ),
    );

    assert.equal(
      typeof buildSubjectReportModelPayload,
      "function",
    );

    assert.equal(
      typeof buildSubjectReportModel,
      "function",
    );
  },
);

test(
  "empty report model keeps stable sections and null semantics",
  () => {
    const report =
      buildSubjectReportModelPayload({
        subject: SUBJECT,

        generatedAt:
          "2026-08-09T20:00:00.000Z",
      });

    assert.equal(
      report.schema_version,
      "report-model-v1",
    );

    assert.equal(
      report.generated_at,
      "2026-08-09T20:00:00.000Z",
    );

    assert.deepEqual(
      report.subject,
      {
        subject_id:
          SUBJECT.id,

        entity_id:
          SUBJECT.entity_id,

        full_name:
          SUBJECT.full_name,

        organization:
          SUBJECT.organization,

        position:
          SUBJECT.position,

        city:
          SUBJECT.city,

        status: null,
      },
    );

    assert.equal(
      report.meta.report_id,
      null,
    );

    assert.deepEqual(
      report.meta.available_years,
      [],
    );

    assert.equal(
      report.identity.resolution_status,
      null,
    );

    assert.equal(
      report.identity.hard_match,
      null,
    );

    assert.equal(
      report.mentions.total,
      null,
    );

    assert.deepEqual(
      report.mentions.items,
      [],
    );

    assert.deepEqual(
      report.analytics,
      {
        metrics: [],
        transitions: [],
        findings: [],
      },
    );

    assert.deepEqual(
      report.methodology.limitations,
      REPORT_MODEL_LIMITATIONS,
    );
  },
);

test(
  "report model loader uses injected subject loader",
  async () => {
    let requestedId = null;

    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          generatedAt:
            new Date(
              "2026-08-09T21:00:00.000Z",
            ),

          subjectLoader:
            async (subjectId) => {
              requestedId =
                subjectId;

              return SUBJECT;
            },
        },
      );

    assert.equal(
      requestedId,
      SUBJECT.id,
    );

    assert.equal(
      report.subject.subject_id,
      SUBJECT.id,
    );

    assert.equal(
      report.subject.entity_id,
      SUBJECT.entity_id,
    );

    assert.equal(
      report.generated_at,
      "2026-08-09T21:00:00.000Z",
    );
  },
);

test(
  "report model loader returns null for missing subject",
  async () => {
    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          subjectLoader:
            async () => null,
        },
      );

    assert.equal(
      report,
      null,
    );
  },
);
