import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JSON_HASH_VERSION,
  canonicalJson,
  canonicalJsonHash,
} from "../src/canonical-json.js";

import {
  DOSSIER_VERSION_STORE_VERSION,
  loadDossierVersionById,
  loadLatestDossierVersion,
  saveDossierVersion,
} from "../src/dossier-version-store.js";


const SUBJECT_ID =
  "11111111-1111-4111-8111-111111111111";

const VERSION_ID =
  "22222222-2222-4222-8222-222222222222";


function reportPayload(
  overrides = {},
) {
  return {
    schema_version:
      "report-model-v1",

    generated_at:
      "2026-08-12T06:00:00.000Z",

    meta: {
      report_id:
        null,
    },

    subject: {
      subject_id:
        SUBJECT_ID,
    },

    declarations: {
      available_years: [
        2025,
      ],
      items: [],
    },

    ...overrides,
  };
}


function capturedSql(
  rowFactory,
) {
  const calls = [];

  const sql =
    async (
      strings,
      ...values
    ) => {
      const call = {
        text:
          strings.join(
            "?",
          ),
        values,
      };

      calls.push(
        call,
      );

      return [
        rowFactory(
          call,
          calls.length,
        ),
      ];
    };

  return {
    sql,
    calls,
  };
}


test(
  "dossier version store inserts canonical immutable snapshot metadata",
  async () => {
    const report =
      reportPayload();

    const capture =
      capturedSql(
        (call) => ({
          id:
            VERSION_ID,

          subject_id:
            call.values[0],

          dossier_status:
            call.values[1],

          orchestrator_version:
            call.values[2],

          report_schema_version:
            call.values[3],

          report_generated_at:
            call.values[4],

          report_payload:
            report,

          report_payload_hash:
            call.values[6],

          report_payload_hash_version:
            call.values[7],

          metadata: {},

          created_at:
            "2026-08-12T06:01:00.000Z",
        }),
      );

    const saved =
      await saveDossierVersion(
        {
          subjectId:
            SUBJECT_ID,

          dossierStatus:
            "completed",

          orchestratorVersion:
            "dossier-orchestrator-v1",

          report,
        },
        {
          sql:
            capture.sql,
        },
      );

    assert.equal(
      DOSSIER_VERSION_STORE_VERSION,
      "dossier-version-store-v1",
    );

    assert.equal(
      capture.calls.length,
      1,
    );

    const call =
      capture.calls[0];

    assert.match(
      call.text,
      /INSERT INTO dossier_versions/,
    );

    assert.doesNotMatch(
      call.text,
      /ON CONFLICT|UPDATE dossier_versions/i,
    );

    assert.equal(
      call.values[0],
      SUBJECT_ID,
    );

    assert.equal(
      call.values[1],
      "completed",
    );

    assert.equal(
      call.values[2],
      "dossier-orchestrator-v1",
    );

    assert.equal(
      call.values[3],
      "report-model-v1",
    );

    assert.equal(
      call.values[4],
      "2026-08-12T06:00:00.000Z",
    );

    assert.equal(
      call.values[5],
      canonicalJson(
        report,
      ),
    );

    assert.equal(
      saved.id,
      VERSION_ID,
    );

    assert.equal(
      report.meta.report_id,
      null,
    );

    assert.equal(
      JSON.parse(
        call.values[5],
      ).meta.report_id,
      null,
    );

    assert.notEqual(
      saved.id,
      report.meta.report_id,
    );

    assert.equal(
      call.values[6],
      canonicalJsonHash(
        report,
      ),
    );

    assert.equal(
      call.values[7],
      CANONICAL_JSON_HASH_VERSION,
    );

    assert.equal(
      call.values[8],
      "{}",
    );

    assert.equal(
      saved.report_payload_hash,
      canonicalJsonHash(
        report,
      ),
    );

    assert.equal(
      saved.report_payload_hash_version,
      CANONICAL_JSON_HASH_VERSION,
    );

    assert.equal(
      saved.created_at,
      "2026-08-12T06:01:00.000Z",
    );
  },
);


test(
  "dossier version store allows repeated snapshots without deduplication",
  async () => {
    const report =
      reportPayload();

    const capture =
      capturedSql(
        (call, number) => ({
          id:
            number === 1
              ? VERSION_ID
              : "33333333-3333-4333-8333-333333333333",

          subject_id:
            call.values[0],

          dossier_status:
            call.values[1],

          orchestrator_version:
            call.values[2],

          report_schema_version:
            call.values[3],

          report_generated_at:
            call.values[4],

          report_payload:
            report,

          report_payload_hash:
            call.values[6],

          report_payload_hash_version:
            call.values[7],

          metadata: {},
          created_at:
            "2026-08-12T06:01:00.000Z",
        }),
      );

    await saveDossierVersion(
      {
        subjectId:
          SUBJECT_ID,
        dossierStatus:
          "completed",
        orchestratorVersion:
          "dossier-orchestrator-v1",
        report,
      },
      {
        sql:
          capture.sql,
      },
    );

    await saveDossierVersion(
      {
        subjectId:
          SUBJECT_ID,
        dossierStatus:
          "completed",
        orchestratorVersion:
          "dossier-orchestrator-v1",
        report,
      },
      {
        sql:
          capture.sql,
      },
    );

    assert.equal(
      capture.calls.length,
      2,
    );

    assert.equal(
      capture.calls[0].values[6],
      capture.calls[1].values[6],
    );
  },
);


test(
  "dossier version store rejects failed dossier before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      saveDossierVersion(
        {
          subjectId:
            SUBJECT_ID,

          dossierStatus:
            "failed",

          orchestratorVersion:
            "dossier-orchestrator-v1",

          report:
            reportPayload(),
        },
        {
          sql,
        },
      ),
      TypeError,
    );

    assert.equal(
      calls,
      0,
    );
  },
);


test(
  "dossier version store rejects subject mismatch before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      saveDossierVersion(
        {
          subjectId:
            SUBJECT_ID,

          dossierStatus:
            "completed",

          orchestratorVersion:
            "dossier-orchestrator-v1",

          report:
            reportPayload({
              subject: {
                subject_id:
                  "44444444-4444-4444-8444-444444444444",
              },
            }),
        },
        {
          sql,
        },
      ),
      TypeError,
    );

    assert.equal(
      calls,
      0,
    );
  },
);


test(
  "dossier version store rejects non-canonical report values before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    const report =
      reportPayload({
        unsupported:
          undefined,
      });

    await assert.rejects(
      saveDossierVersion(
        {
          subjectId:
            SUBJECT_ID,

          dossierStatus:
            "partial",

          orchestratorVersion:
            "dossier-orchestrator-v1",

          report,
        },
        {
          sql,
        },
      ),
      TypeError,
    );

    assert.equal(
      calls,
      0,
    );
  },
);

test(
  "dossier version store loads latest subject snapshot deterministically",
  async () => {
    const report =
      reportPayload();

    const capture =
      capturedSql(
        (call) => ({
          id:
            VERSION_ID,

          subject_id:
            call.values[0],

          dossier_status:
            "completed",

          orchestrator_version:
            "dossier-orchestrator-v1",

          report_schema_version:
            "report-model-v1",

          report_generated_at:
            "2026-08-12T06:00:00.000Z",

          report_payload:
            report,

          report_payload_hash:
            canonicalJsonHash(
              report,
            ),

          report_payload_hash_version:
            CANONICAL_JSON_HASH_VERSION,

          metadata: {},

          created_at:
            "2026-08-12T06:01:00.000Z",
        }),
      );

    const loaded =
      await loadLatestDossierVersion(
        {
          subjectId:
            SUBJECT_ID,
        },
        {
          sql:
            capture.sql,
        },
      );

    assert.equal(
      capture.calls.length,
      1,
    );

    const call =
      capture.calls[0];

    assert.match(
      call.text,
      /FROM dossier_versions/,
    );

    assert.match(
      call.text,
      /WHERE subject_id/,
    );

    assert.match(
      call.text,
      /ORDER BY[\s\S]*created_at DESC[\s\S]*id DESC/,
    );

    assert.match(
      call.text,
      /LIMIT 1/,
    );

    assert.equal(
      call.values[0],
      SUBJECT_ID,
    );

    assert.equal(
      loaded.id,
      VERSION_ID,
    );

    assert.equal(
      loaded.subject_id,
      SUBJECT_ID,
    );

    assert.deepEqual(
      loaded.report_payload,
      report,
    );
  },
);


test(
  "dossier version store returns null when latest subject snapshot is missing",
  async () => {
    const sql =
      async () =>
        [];

    const loaded =
      await loadLatestDossierVersion(
        {
          subjectId:
            SUBJECT_ID,
        },
        {
          sql,
        },
      );

    assert.equal(
      loaded,
      null,
    );
  },
);


test(
  "dossier version store loads snapshot by dossier version id",
  async () => {
    const report =
      reportPayload();

    const capture =
      capturedSql(
        (call) => ({
          id:
            call.values[0],

          subject_id:
            SUBJECT_ID,

          dossier_status:
            "partial",

          orchestrator_version:
            "dossier-orchestrator-v1",

          report_schema_version:
            "report-model-v1",

          report_generated_at:
            "2026-08-12T06:00:00.000Z",

          report_payload:
            report,

          report_payload_hash:
            canonicalJsonHash(
              report,
            ),

          report_payload_hash_version:
            CANONICAL_JSON_HASH_VERSION,

          metadata: {
            reason:
              "refresh_partial",
          },

          created_at:
            "2026-08-12T06:02:00.000Z",
        }),
      );

    const loaded =
      await loadDossierVersionById(
        {
          dossierVersionId:
            VERSION_ID,
        },
        {
          sql:
            capture.sql,
        },
      );

    const call =
      capture.calls[0];

    assert.match(
      call.text,
      /FROM dossier_versions/,
    );

    assert.match(
      call.text,
      /WHERE id/,
    );

    assert.equal(
      call.values[0],
      VERSION_ID,
    );

    assert.equal(
      loaded.id,
      VERSION_ID,
    );

    assert.equal(
      loaded.dossier_status,
      "partial",
    );

    assert.deepEqual(
      loaded.metadata,
      {
        reason:
          "refresh_partial",
      },
    );
  },
);


test(
  "dossier version store returns null when version id is missing",
  async () => {
    const sql =
      async () =>
        [];

    const loaded =
      await loadDossierVersionById(
        {
          dossierVersionId:
            VERSION_ID,
        },
        {
          sql,
        },
      );

    assert.equal(
      loaded,
      null,
    );
  },
);


test(
  "latest dossier read validates subject id before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      loadLatestDossierVersion(
        {
          subjectId:
            "invalid",
        },
        {
          sql,
        },
      ),
      TypeError,
    );

    assert.equal(
      calls,
      0,
    );
  },
);


test(
  "dossier version id read validates id before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      loadDossierVersionById(
        {
          dossierVersionId:
            "invalid",
        },
        {
          sql,
        },
      ),
      TypeError,
    );

    assert.equal(
      calls,
      0,
    );
  },
);
