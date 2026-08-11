import test from "node:test";
import assert from "node:assert/strict";


test(
  "report exposes analytical brief and evidence policy versions",
  async () => {
    const reportModel =
      await import(
        "../src/report-model.js"
      );

    assert.equal(
      reportModel
        .ANALYTICAL_BRIEF_VERSION,
      "analytical-brief-v1",
    );

    assert.equal(
      reportModel
        .REPORT_EVIDENCE_POLICY_VERSION,
      "report-evidence-policy-v1",
    );

    const report =
      reportModel
        .buildSubjectReportModelPayload({
          subject: {
            id:
              "11111111-1111-4111-8111-111111111111",

            full_name:
              "Тестова Особа",
          },
        });

    assert.equal(
      report
        .analytical_brief
        .version,
      reportModel
        .ANALYTICAL_BRIEF_VERSION,
    );

    assert.equal(
      report
        .methodology
        .analytical_brief_version,
      reportModel
        .ANALYTICAL_BRIEF_VERSION,
    );

    assert.equal(
      report
        .methodology
        .evidence_policy_version,
      reportModel
        .REPORT_EVIDENCE_POLICY_VERSION,
    );
  },
);
