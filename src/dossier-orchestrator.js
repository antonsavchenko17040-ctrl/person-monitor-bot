import {
  monitorSubject,
} from "./monitor.js";

import {
  buildSubjectReportModel,
} from "./report-model.js";

import {
  getSubject,
} from "./store.js";

export const DOSSIER_ORCHESTRATOR_VERSION =
  "dossier-orchestrator-v1";

export async function runSubjectDossier(
  subjectId,
  options = {},
) {
  const subjectLoader =
    options.subjectLoader ??
    getSubject;

  const refreshSubject =
    options.refreshSubject ??
    monitorSubject;

  const reportBuilder =
    options.reportBuilder ??
    buildSubjectReportModel;

  const subject =
    await subjectLoader(
      subjectId,
    );

  if (!subject) {
    return {
      version:
        DOSSIER_ORCHESTRATOR_VERSION,

      status:
        "failed",

      subject:
        null,

      refresh:
        null,

      report:
        null,

      errors: [
        {
          step:
            "subject",

          code:
            "subject_not_found",

          message:
            "Subject not found",
        },
      ],

      steps: {
        subject: {
          status:
            "failed",
        },

        refresh: {
          status:
            "skipped",
        },

        report: {
          status:
            "skipped",
        },
      },
    };
  }

  const errors = [];

  let refresh =
    null;

  let refreshStatus =
    "completed";

  try {
    refresh =
      await refreshSubject(
        subject,
      );
  } catch (error) {
    refreshStatus =
      "failed";

    errors.push({
      step:
        "refresh",

      code:
        "refresh_failed",

      message:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }

  let report =
    null;

  let reportStatus =
    "completed";

  try {
    report =
      await reportBuilder(
        subjectId,
        options.reportOptions ?? {},
      );
  } catch (error) {
    reportStatus =
      "failed";

    errors.push({
      step:
        "report",

      code:
        "report_failed",

      message:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }

  return {
    version:
      DOSSIER_ORCHESTRATOR_VERSION,

    status:
      reportStatus === "failed"
        ? "failed"
        : errors.length
          ? "partial"
          : "completed",

    subject,

    refresh,

    report,

    errors,

    steps: {
      subject: {
        status:
          "completed",
      },

      refresh: {
        status:
          refreshStatus,
      },

      report: {
        status:
          reportStatus,
      },
    },
  };
}
