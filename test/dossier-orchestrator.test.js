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
