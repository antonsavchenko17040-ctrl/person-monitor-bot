import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_MODEL_LIMITATIONS,
  REPORT_MODEL_SCHEMA_VERSION,
  buildDeclarationSection,
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

          declarationYearsLoader:
            async () => [],
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

test(
  "declaration section maps canonical submission",
  () => {
    const section =
      buildDeclarationSection({
        availableYears: [2025],
        contexts: [{
          analytics: {
            yearly: [{
              year: 2025,
              sourceDocumentId: "doc-2",
            }],
          },
          source_documents: [
            { id: "doc-1", url: "https://example.test/1" },
            { id: "doc-2", url: "https://example.test/2" },
          ],
          facts: [
            {
              id: "f1",
              fact_type: "declaration_submission",
              source_document_id: "doc-1",
              value_json: {
                declaration_year: 2025,
                document_guid: "guid-1",
                registry: "annual",
                published_at: "2026-03-01T10:00:00.000Z",
              },
            },
            {
              id: "f2",
              fact_type: "declaration_submission",
              source_document_id: "doc-2",
              value_json: {
                declaration_year: 2025,
                document_guid: "guid-2",
                registry: "annual",
                published_at: "2026-03-20T10:00:00.000Z",
              },
            },
          ],
        }],
      });

    assert.deepEqual(
      section.available_years,
      [2025],
    );

    assert.equal(
      section.items.length,
      2,
    );

    const canonical =
      section.items.find(
        (item) => item.canonical,
      );

    assert.equal(
      canonical?.document_guid,
      "guid-2",
    );

    assert.equal(
      canonical?.registry,
      "annual",
    );

    assert.equal(
      canonical?.source_url,
      "https://example.test/2",
    );
  },
);

test(
  "report model loader populates declaration years and period",
  async () => {
    const report =
      await buildSubjectReportModel(
        SUBJECT.id,
        {
          subjectLoader:
            async () => SUBJECT,

          declarationYearsLoader:
            async () => [2025, 2024],

          declarationContextLoader:
            async (_entityId, year) => ({
              analytics: {
                yearly: [{
                  year,
                  sourceDocumentId: `doc-${year}`,
                }],
              },
              source_documents: [{
                id: `doc-${year}`,
                url: `https://example.test/${year}`,
              }],
              facts: [{
                id: `f-${year}`,
                fact_type: "declaration_submission",
                source_document_id: `doc-${year}`,
                value_json: {
                  declaration_year: year,
                  document_guid: `guid-${year}`,
                  registry: "annual",
                },
              }],
            }),
        },
      );

    assert.deepEqual(
      report.declarations.available_years,
      [2025, 2024],
    );

    assert.equal(
      report.declarations.items.length,
      2,
    );

    assert.deepEqual(
      report.meta.period,
      {
        from_year: 2024,
        to_year: 2025,
      },
    );
  },
);
