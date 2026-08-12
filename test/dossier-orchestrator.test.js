import test from "node:test";
import assert from "node:assert/strict";

import {
  DOSSIER_ORCHESTRATOR_VERSION,
  runSubjectDossier,
} from "../src/dossier-orchestrator.js";

test(
  "runs subject refresh and canonical report as one dossier workflow",
  async () => {
    const calls = [];

    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const refreshResult = {
      scanned: 3,
      mentions: [],
      newMentions: [],
      errors: [],
    };

    const report = {
      schema_version: "report-model-v1",
      subject: {
        subject_id: 42,
      },
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async (subjectId) => {
              calls.push([
                "subject",
                subjectId,
              ]);

              return subject;
            },

          refreshSubject:
            async (loadedSubject) => {
              calls.push([
                "refresh",
                loadedSubject.id,
              ]);

              return refreshResult;
            },

          reportBuilder:
            async (subjectId) => {
              calls.push([
                "report",
                subjectId,
              ]);

              return report;
            },
        },
      );

    assert.equal(
      DOSSIER_ORCHESTRATOR_VERSION,
      "dossier-orchestrator-v1",
    );

    assert.equal(
      result.version,
      DOSSIER_ORCHESTRATOR_VERSION,
    );

    assert.equal(
      result.status,
      "completed",
    );

    assert.equal(
      result.subject.id,
      42,
    );

    assert.deepEqual(
      result.refresh,
      refreshResult,
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.deepEqual(
      result.errors,
      [],
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "completed",
        },

        report: {
          status: "completed",
        },
      },
    );

    assert.deepEqual(
      calls,
      [
        [
          "subject",
          42,
        ],
        [
          "refresh",
          42,
        ],
        [
          "report",
          42,
        ],
      ],
    );
  },
);


test(
  "fails safely when subject does not exist",
  async () => {
    let refreshCalled =
      false;

    let reportCalled =
      false;

    const result =
      await runSubjectDossier(
        999,
        {
          subjectLoader:
            async () =>
              null,

          refreshSubject:
            async () => {
              refreshCalled =
                true;

              throw new Error(
                "refresh must not run",
              );
            },

          reportBuilder:
            async () => {
              reportCalled =
                true;

              throw new Error(
                "report must not run",
              );
            },
        },
      );

    assert.equal(
      result.status,
      "failed",
    );

    assert.equal(
      result.subject,
      null,
    );

    assert.equal(
      result.refresh,
      null,
    );

    assert.equal(
      result.report,
      null,
    );

    assert.equal(
      refreshCalled,
      false,
    );

    assert.equal(
      reportCalled,
      false,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "failed",
        },

        refresh: {
          status: "skipped",
        },

        report: {
          status: "skipped",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "subject",
          code: "subject_not_found",
          message:
            "Subject not found",
        },
      ],
    );
  },
);


test(
  "builds existing dossier when refresh fails",
  async () => {
    let reportCalled =
      false;

    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const report = {
      schema_version:
        "report-model-v1",

      subject: {
        subject_id:
          42,
      },
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () => {
              throw new Error(
                "refresh unavailable",
              );
            },

          reportBuilder:
            async (subjectId) => {
              reportCalled =
                true;

              assert.equal(
                subjectId,
                42,
              );

              return report;
            },
        },
      );

    assert.equal(
      reportCalled,
      true,
    );

    assert.equal(
      result.status,
      "partial",
    );

    assert.deepEqual(
      result.subject,
      subject,
    );

    assert.equal(
      result.refresh,
      null,
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "failed",
        },

        report: {
          status: "completed",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "refresh",
          code: "refresh_failed",
          message:
            "refresh unavailable",
        },
      ],
    );
  },
);


test(
  "fails safely when canonical report build fails",
  async () => {
    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const refreshResult = {
      scanned: 2,
      mentions: [],
      newMentions: [],
      errors: [],
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () =>
              refreshResult,

          reportBuilder:
            async () => {
              throw new Error(
                "report unavailable",
              );
            },
        },
      );

    assert.equal(
      result.status,
      "failed",
    );

    assert.deepEqual(
      result.subject,
      subject,
    );

    assert.deepEqual(
      result.refresh,
      refreshResult,
    );

    assert.equal(
      result.report,
      null,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "completed",
        },

        report: {
          status: "failed",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "report",
          code: "report_failed",
          message:
            "report unavailable",
        },
      ],
    );
  },
);


test(
  "preserves refresh and report errors when both steps fail",
  async () => {
    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () => {
              throw new Error(
                "refresh unavailable",
              );
            },

          reportBuilder:
            async () => {
              throw new Error(
                "report unavailable",
              );
            },
        },
      );

    assert.equal(
      result.status,
      "failed",
    );

    assert.deepEqual(
      result.subject,
      subject,
    );

    assert.equal(
      result.refresh,
      null,
    );

    assert.equal(
      result.report,
      null,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "failed",
        },

        report: {
          status: "failed",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "refresh",
          code: "refresh_failed",
          message:
            "refresh unavailable",
        },

        {
          step: "report",
          code: "report_failed",
          message:
            "report unavailable",
        },
      ],
    );
  },
);


test(
  "runs ingestion between refresh and canonical report",
  async () => {
    const calls = [];

    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const refreshResult = {
      scanned: 1,
      mentions: [],
      newMentions: [],
      errors: [],
    };

    const ingestionResult = {
      facts: 3,
      relations: 2,
    };

    const report = {
      schema_version:
        "report-model-v1",
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () => {
              calls.push(
                "subject",
              );

              return subject;
            },

          refreshSubject:
            async () => {
              calls.push(
                "refresh",
              );

              return refreshResult;
            },

          ingestSubject:
            async (loadedSubject) => {
              calls.push(
                "ingest",
              );

              assert.equal(
                loadedSubject.id,
                42,
              );

              return ingestionResult;
            },

          reportBuilder:
            async () => {
              calls.push(
                "report",
              );

              return report;
            },
        },
      );

    assert.deepEqual(
      calls,
      [
        "subject",
        "refresh",
        "ingest",
        "report",
      ],
    );

    assert.deepEqual(
      result.ingestion,
      ingestionResult,
    );

    assert.equal(
      result.steps.ingestion.status,
      "completed",
    );

    assert.equal(
      result.status,
      "completed",
    );
  },
);


test(
  "builds canonical report when ingestion fails",
  async () => {
    let reportCalled =
      false;

    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const refreshResult = {
      scanned: 1,
      mentions: [],
      newMentions: [],
      errors: [],
    };

    const report = {
      schema_version:
        "report-model-v1",
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () =>
              refreshResult,

          ingestSubject:
            async () => {
              throw new Error(
                "ingestion unavailable",
              );
            },

          reportBuilder:
            async () => {
              reportCalled =
                true;

              return report;
            },
        },
      );

    assert.equal(
      reportCalled,
      true,
    );

    assert.equal(
      result.status,
      "partial",
    );

    assert.deepEqual(
      result.subject,
      subject,
    );

    assert.deepEqual(
      result.refresh,
      refreshResult,
    );

    assert.equal(
      result.ingestion,
      null,
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "completed",
        },

        ingestion: {
          status: "failed",
        },

        report: {
          status: "completed",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "ingestion",
          code: "ingestion_failed",
          message:
            "ingestion unavailable",
        },
      ],
    );
  },
);


test(
  "preserves refresh and ingestion errors while building report",
  async () => {
    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const report = {
      schema_version:
        "report-model-v1",
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () => {
              throw new Error(
                "refresh unavailable",
              );
            },

          ingestSubject:
            async () => {
              throw new Error(
                "ingestion unavailable",
              );
            },

          reportBuilder:
            async () =>
              report,
        },
      );

    assert.equal(
      result.status,
      "partial",
    );

    assert.equal(
      result.refresh,
      null,
    );

    assert.equal(
      result.ingestion,
      null,
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "failed",
        },

        ingestion: {
          status: "failed",
        },

        report: {
          status: "completed",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "refresh",
          code: "refresh_failed",
          message:
            "refresh unavailable",
        },

        {
          step: "ingestion",
          code: "ingestion_failed",
          message:
            "ingestion unavailable",
        },
      ],
    );
  },
);


test(
  "marks refresh partial when provider errors are returned",
  async () => {
    const subject = {
      id: 42,
      entity_id: "entity-42",
      full_name: "Олексій Чернишов",
    };

    const refreshResult = {
      scanned: 2,
      mentions: [],
      newMentions: [],
      errors: [
        {
          provider:
            "google_news",

          error:
            "provider unavailable",
        },
      ],
    };

    const report = {
      schema_version:
        "report-model-v1",
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () =>
              refreshResult,

          reportBuilder:
            async () =>
              report,
        },
      );

    assert.equal(
      result.status,
      "partial",
    );

    assert.deepEqual(
      result.refresh,
      refreshResult,
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.deepEqual(
      result.steps,
      {
        subject: {
          status: "completed",
        },

        refresh: {
          status: "partial",
        },

        report: {
          status: "completed",
        },
      },
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step: "refresh",
          code: "refresh_partial",
          message:
            "Refresh completed with provider errors",
          count: 1,
        },
      ],
    );
  },
);

test(
  "persists completed canonical dossier after report build",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const subject = {
      id:
        subjectId,
      full_name:
        "Олексій Чернишов",
    };

    const report = {
      schema_version:
        "report-model-v1",

      generated_at:
        "2026-08-12T06:30:00.000Z",

      subject: {
        subject_id:
          subjectId,
      },
    };

    const version = {
      id:
        "22222222-2222-4222-8222-222222222222",
    };

    const calls = [];

    const result =
      await runSubjectDossier(
        subjectId,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () => ({
              errors: [],
            }),

          reportBuilder:
            async () =>
              report,

          persistDossier:
            async (input) => {
              calls.push(
                input,
              );

              return version;
            },
        },
      );

    assert.equal(
      result.status,
      "completed",
    );

    assert.deepEqual(
      result.dossier_version,
      version,
    );

    assert.equal(
      result.steps.persistence.status,
      "completed",
    );

    assert.equal(
      calls.length,
      1,
    );

    assert.deepEqual(
      calls[0],
      {
        subjectId,

        dossierStatus:
          "completed",

        orchestratorVersion:
          DOSSIER_ORCHESTRATOR_VERSION,

        report,
      },
    );
  },
);


test(
  "persists partial dossier when earlier workflow step is partial",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const report = {
      schema_version:
        "report-model-v1",

      generated_at:
        "2026-08-12T06:30:00.000Z",

      subject: {
        subject_id:
          subjectId,
      },
    };

    let persistedStatus =
      null;

    const result =
      await runSubjectDossier(
        subjectId,
        {
          subjectLoader:
            async () => ({
              id:
                subjectId,
            }),

          refreshSubject:
            async () => ({
              errors: [
                {
                  code:
                    "provider_failed",
                },
              ],
            }),

          reportBuilder:
            async () =>
              report,

          persistDossier:
            async (input) => {
              persistedStatus =
                input.dossierStatus;

              return {
                id:
                  "22222222-2222-4222-8222-222222222222",
              };
            },
        },
      );

    assert.equal(
      persistedStatus,
      "partial",
    );

    assert.equal(
      result.status,
      "partial",
    );

    assert.equal(
      result.steps.refresh.status,
      "partial",
    );

    assert.equal(
      result.steps.persistence.status,
      "completed",
    );

    assert.equal(
      result.errors[0]?.code,
      "refresh_partial",
    );
  },
);


test(
  "keeps canonical report and returns partial when persistence fails",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const report = {
      schema_version:
        "report-model-v1",

      generated_at:
        "2026-08-12T06:30:00.000Z",

      subject: {
        subject_id:
          subjectId,
      },
    };

    const result =
      await runSubjectDossier(
        subjectId,
        {
          subjectLoader:
            async () => ({
              id:
                subjectId,
            }),

          refreshSubject:
            async () => ({
              errors: [],
            }),

          reportBuilder:
            async () =>
              report,

          persistDossier:
            async () => {
              throw new Error(
                "database unavailable",
              );
            },
        },
      );

    assert.equal(
      result.status,
      "partial",
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.equal(
      result.dossier_version,
      null,
    );

    assert.equal(
      result.steps.report.status,
      "completed",
    );

    assert.equal(
      result.steps.persistence.status,
      "failed",
    );

    assert.deepEqual(
      result.errors,
      [
        {
          step:
            "persistence",

          code:
            "persistence_failed",

          message:
            "database unavailable",
        },
      ],
    );
  },
);


test(
  "skips persistence when canonical report build fails",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    let persistenceCalls =
      0;

    const result =
      await runSubjectDossier(
        subjectId,
        {
          subjectLoader:
            async () => ({
              id:
                subjectId,
            }),

          refreshSubject:
            async () => ({
              errors: [],
            }),

          reportBuilder:
            async () => {
              throw new Error(
                "report unavailable",
              );
            },

          persistDossier:
            async () => {
              persistenceCalls +=
                1;

              return {
                id:
                  "22222222-2222-4222-8222-222222222222",
              };
            },
        },
      );

    assert.equal(
      result.status,
      "failed",
    );

    assert.equal(
      result.report,
      null,
    );

    assert.equal(
      result.dossier_version,
      null,
    );

    assert.equal(
      result.steps.persistence.status,
      "skipped",
    );

    assert.equal(
      persistenceCalls,
      0,
    );
  },
);


test(
  "syncs manual review queue after successful dossier persistence",
  async () => {
    const calls = [];

    const subject = {
      id: 42,
      full_name:
        "Тестовий Суб’єкт",
    };

    const manualReview = {
      version:
        "manual-review-manifest-v1",

      items: [{
        source_path:
          "related_people.items",

        item_ref:
          "related-person-ref-v1:" +
          "a".repeat(64),

        review_type:
          "identity_resolution",
      }],
    };

    const report = {
      schema_version:
        "report-model-v1",

      manual_review:
        manualReview,
    };

    const dossierVersion = {
      id:
        "11111111-1111-4111-8111-111111111111",
    };

    const reviewSummary = {
      item_count:
        1,

      occurrences_created:
        1,
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () =>
              subject,

          refreshSubject:
            async () => ({
              errors: [],
            }),

          reportBuilder:
            async () =>
              report,

          persistDossier:
            async () => {
              calls.push(
                "persistence",
              );

              return dossierVersion;
            },

          syncManualReview:
            async (input) => {
              calls.push(
                "review_queue",
              );

              assert.deepEqual(
                input,
                {
                  subjectId:
                    42,

                  dossierVersionId:
                    dossierVersion.id,

                  manualReview,
                },
              );

              return reviewSummary;
            },
        },
      );

    assert.deepEqual(
      calls,
      [
        "persistence",
        "review_queue",
      ],
    );

    assert.equal(
      result.status,
      "completed",
    );

    assert.deepEqual(
      result.dossier_version,
      dossierVersion,
    );

    assert.deepEqual(
      result.review_queue,
      reviewSummary,
    );

    assert.equal(
      result.steps.persistence.status,
      "completed",
    );

    assert.equal(
      result.steps.review_queue.status,
      "completed",
    );
  },
);


test(
  "skips manual review queue when dossier persistence fails",
  async () => {
    let reviewCalls =
      0;

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () => ({
              id: 42,
            }),

          refreshSubject:
            async () => ({
              errors: [],
            }),

          reportBuilder:
            async () => ({
              schema_version:
                "report-model-v1",

              manual_review: {
                version:
                  "manual-review-manifest-v1",

                items: [],
              },
            }),

          persistDossier:
            async () => {
              throw new Error(
                "database unavailable",
              );
            },

          syncManualReview:
            async () => {
              reviewCalls +=
                1;

              return {};
            },
        },
      );

    assert.equal(
      reviewCalls,
      0,
    );

    assert.equal(
      result.status,
      "partial",
    );

    assert.equal(
      result.dossier_version,
      null,
    );

    assert.equal(
      result.review_queue,
      null,
    );

    assert.equal(
      result.steps.persistence.status,
      "failed",
    );

    assert.equal(
      result.steps.review_queue.status,
      "skipped",
    );

    assert.equal(
      result.errors.some(
        (error) =>
          error.code ===
          "persistence_failed",
      ),
      true,
    );
  },
);


test(
  "keeps persisted dossier and returns partial when manual review sync fails",
  async () => {
    const dossierVersion = {
      id:
        "22222222-2222-4222-8222-222222222222",
    };

    const report = {
      schema_version:
        "report-model-v1",

      manual_review: {
        version:
          "manual-review-manifest-v1",

        items: [],
      },
    };

    const result =
      await runSubjectDossier(
        42,
        {
          subjectLoader:
            async () => ({
              id: 42,
            }),

          refreshSubject:
            async () => ({
              errors: [],
            }),

          reportBuilder:
            async () =>
              report,

          persistDossier:
            async () =>
              dossierVersion,

          syncManualReview:
            async () => {
              throw new Error(
                "review queue unavailable",
              );
            },
        },
      );

    assert.equal(
      result.status,
      "partial",
    );

    assert.deepEqual(
      result.report,
      report,
    );

    assert.deepEqual(
      result.dossier_version,
      dossierVersion,
    );

    assert.equal(
      result.review_queue,
      null,
    );

    assert.equal(
      result.steps.persistence.status,
      "completed",
    );

    assert.equal(
      result.steps.review_queue.status,
      "failed",
    );

    assert.deepEqual(
      result.errors.at(-1),
      {
        step:
          "review_queue",

        code:
          "manual_review_sync_failed",

        message:
          "review queue unavailable",
      },
    );
  },
);
