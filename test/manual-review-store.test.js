import assert from "node:assert/strict";
import test from "node:test";

import {
  MANUAL_REVIEW_MANIFEST_VERSION,
} from "../src/manual-review-contract.js";

import {
  MANUAL_REVIEW_LIST_DEFAULT_LIMIT,
  MANUAL_REVIEW_LIST_MAX_LIMIT,
  MANUAL_REVIEW_STORE_VERSION,
  listManualReviewTasks,
  setManualReviewTaskStatus,
  syncManualReviewTasks,
} from "../src/manual-review-store.js";


const SUBJECT_ID =
  "11111111-1111-4111-8111-111111111111";

const OTHER_SUBJECT_ID =
  "22222222-2222-4222-8222-222222222222";

const DOSSIER_VERSION_ID =
  "33333333-3333-4333-8333-333333333333";

const RELATED_REF =
  "related-person-ref-v1:" +
  "a".repeat(64);

const RELATION_REF =
  "44444444-4444-5444-8444-444444444444";


function manifest(
  items = [],
) {
  return {
    version:
      MANUAL_REVIEW_MANIFEST_VERSION,

    items,
  };
}


function relatedItem(
  overrides = {},
) {
  return {
    source_path:
      "related_people.items",

    item_ref:
      RELATED_REF,

    review_type:
      "identity_resolution",

    ...overrides,
  };
}


function relationItem(
  overrides = {},
) {
  return {
    source_path:
      "relations.items",

    item_ref:
      RELATION_REF,

    review_type:
      "identity_resolution",

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
  "manual review store atomically syncs reference-only tasks and occurrences",
  async () => {
    const capture =
      capturedSql(
        () => ({
          dossier_version_exists:
            true,

          subject_matches:
            true,

          item_count:
            2,

          task_count:
            2,

          occurrences_created:
            2,
        }),
      );

    const result =
      await syncManualReviewTasks(
        {
          subjectId:
            SUBJECT_ID,

          dossierVersionId:
            DOSSIER_VERSION_ID,

          manualReview:
            manifest([
              relatedItem(),
              relatedItem(),
              relationItem(),
            ]),
        },
        {
          sql:
            capture.sql,
        },
      );

    assert.equal(
      MANUAL_REVIEW_STORE_VERSION,
      "manual-review-store-v1",
    );

    assert.equal(
      capture.calls.length,
      1,
    );

    const call =
      capture.calls[0];

    assert.match(
      call.text,
      /WITH version_row AS/,
    );

    assert.match(
      call.text,
      /jsonb_to_recordset/,
    );

    assert.match(
      call.text,
      /INSERT INTO manual_review_tasks/,
    );

    assert.match(
      call.text,
      /INSERT INTO[\s\n]+manual_review_task_occurrences/,
    );

    assert.match(
      call.text,
      /ON CONFLICT[\s\S]*task_status[\s\n]*=[\s\n]*manual_review_tasks\.task_status/,
    );

    assert.doesNotMatch(
      call.text,
      /task_status[\s\n]*=[\s\n]*"open"/i,
    );

    const itemsJson =
      call.values.find(
        (value) =>
          typeof value === "string" &&
          value.startsWith("["),
      );

    assert.ok(
      itemsJson,
    );

    const storedItems =
      JSON.parse(
        itemsJson,
      );

    assert.deepEqual(
      storedItems,
      [
        relatedItem(),
        relationItem(),
      ],
    );

    assert.equal(
      JSON.stringify(
        storedItems,
      ).includes(
        "full_name",
      ),
      false,
    );

    assert.deepEqual(
      result,
      {
        subject_id:
          SUBJECT_ID,

        dossier_version_id:
          DOSSIER_VERSION_ID,

        manifest_version:
          MANUAL_REVIEW_MANIFEST_VERSION,

        item_count:
          2,

        task_count:
          2,

        occurrences_created:
          2,
      },
    );
  },
);


test(
  "manual review store accepts idempotent repeat without reopening task",
  async () => {
    const capture =
      capturedSql(
        (_call, number) => ({
          dossier_version_exists:
            true,

          subject_matches:
            true,

          item_count:
            1,

          task_count:
            1,

          occurrences_created:
            number === 1
              ? 1
              : 0,
        }),
      );

    const input = {
      subjectId:
        SUBJECT_ID,

      dossierVersionId:
        DOSSIER_VERSION_ID,

      manualReview:
        manifest([
          relatedItem(),
        ]),
    };

    const first =
      await syncManualReviewTasks(
        input,
        {
          sql:
            capture.sql,
        },
      );

    const second =
      await syncManualReviewTasks(
        input,
        {
          sql:
            capture.sql,
        },
      );

    assert.equal(
      first.occurrences_created,
      1,
    );

    assert.equal(
      second.occurrences_created,
      0,
    );

    assert.equal(
      capture.calls.length,
      2,
    );

    for (
      const call
      of capture.calls
    ) {
      assert.match(
        call.text,
        /task_status[\s\n]*=[\s\n]*manual_review_tasks\.task_status/,
      );
    }
  },
);


test(
  "manual review store rejects unsupported manifest before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      syncManualReviewTasks(
        {
          subjectId:
            SUBJECT_ID,

          dossierVersionId:
            DOSSIER_VERSION_ID,

          manualReview: {
            version:
              "manual-review-manifest-v999",

            items: [],
          },
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
  "manual review store rejects non-reference manifest data before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      syncManualReviewTasks(
        {
          subjectId:
            SUBJECT_ID,

          dossierVersionId:
            DOSSIER_VERSION_ID,

          manualReview:
            manifest([{
              ...relatedItem(),
              full_name:
                "PII MUST NOT ENTER QUEUE",
            }]),
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
  "manual review store rejects media and invalid reference shapes",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    const invalidItems = [
      {
        source_path:
          "mentions.items",

        item_ref:
          "media-ref",

        review_type:
          "identity_resolution",
      },

      relatedItem({
        item_ref:
          "related-person-ref-v1:not-a-hash",
      }),

      relationItem({
        item_ref:
          "relation-not-a-uuid",
      }),
    ];

    for (
      const item
      of invalidItems
    ) {
      await assert.rejects(
        syncManualReviewTasks(
          {
            subjectId:
              SUBJECT_ID,

            dossierVersionId:
              DOSSIER_VERSION_ID,

            manualReview:
              manifest([
                item,
              ]),
          },
          {
            sql,
          },
        ),
        TypeError,
      );
    }

    assert.equal(
      calls,
      0,
    );
  },
);


test(
  "manual review store rejects dossier version subject mismatch",
  async () => {
    const capture =
      capturedSql(
        () => ({
          dossier_version_exists:
            true,

          subject_matches:
            false,

          item_count:
            1,

          task_count:
            0,

          occurrences_created:
            0,
        }),
      );

    await assert.rejects(
      syncManualReviewTasks(
        {
          subjectId:
            OTHER_SUBJECT_ID,

          dossierVersionId:
            DOSSIER_VERSION_ID,

          manualReview:
            manifest([
              relatedItem(),
            ]),
        },
        {
          sql:
            capture.sql,
        },
      ),
      /dossier version subject does not match subjectId/,
    );

    assert.equal(
      capture.calls.length,
      1,
    );
  },
);


test(
  "manual review store rejects missing dossier version",
  async () => {
    const capture =
      capturedSql(
        () => ({
          dossier_version_exists:
            false,

          subject_matches:
            false,

          item_count:
            0,

          task_count:
            0,

          occurrences_created:
            0,
        }),
      );

    await assert.rejects(
      syncManualReviewTasks(
        {
          subjectId:
            SUBJECT_ID,

          dossierVersionId:
            DOSSIER_VERSION_ID,

          manualReview:
            manifest([]),
        },
        {
          sql:
            capture.sql,
        },
      ),
      /Dossier version not found/,
    );

    assert.equal(
      capture.calls.length,
      1,
    );
  },
);

test(
  "manual review task list defaults to open and returns reference-only occurrence metadata",
  async () => {
    const capture =
      capturedSql(
        () => ({
          id:
            "55555555-5555-4555-8555-555555555555",

          subject_id:
            SUBJECT_ID,

          source_path:
            "related_people.items",

          item_ref:
            RELATED_REF,

          review_type:
            "identity_resolution",

          task_status:
            "open",

          occurrence_count:
            3,

          latest_dossier_version_id:
            DOSSIER_VERSION_ID,

          latest_occurrence_at:
            "2026-08-12T08:00:00.000Z",

          created_at:
            "2026-08-12T07:00:00.000Z",

          updated_at:
            "2026-08-12T07:30:00.000Z",
        }),
      );

    const rows =
      await listManualReviewTasks(
        {},
        {
          sql:
            capture.sql,
        },
      );

    assert.equal(
      MANUAL_REVIEW_LIST_DEFAULT_LIMIT,
      100,
    );

    assert.equal(
      MANUAL_REVIEW_LIST_MAX_LIMIT,
      200,
    );

    assert.equal(
      capture.calls.length,
      1,
    );

    const call =
      capture.calls[0];

    assert.match(
      call.text,
      /manual_review_task_occurrences/,
    );

    assert.match(
      call.text,
      /LEFT JOIN LATERAL/,
    );

    assert.equal(
      call.values.includes(
        "open",
      ),
      true,
    );

    assert.equal(
      call.values.includes(
        100,
      ),
      true,
    );

    assert.deepEqual(
      rows,
      [{
        id:
          "55555555-5555-4555-8555-555555555555",

        subject_id:
          SUBJECT_ID,

        source_path:
          "related_people.items",

        item_ref:
          RELATED_REF,

        review_type:
          "identity_resolution",

        task_status:
          "open",

        occurrence_count:
          3,

        latest_dossier_version_id:
          DOSSIER_VERSION_ID,

        latest_occurrence_at:
          "2026-08-12T08:00:00.000Z",

        created_at:
          "2026-08-12T07:00:00.000Z",

        updated_at:
          "2026-08-12T07:30:00.000Z",
      }],
    );

    assert.equal(
      JSON.stringify(
        rows,
      ).includes(
        "full_name",
      ),
      false,
    );
  },
);


test(
  "manual review task list supports subject and all-status filters",
  async () => {
    const capture =
      capturedSql(
        () => ({
          id:
            "66666666-6666-4666-8666-666666666666",

          subject_id:
            SUBJECT_ID,

          source_path:
            "relations.items",

          item_ref:
            RELATION_REF,

          review_type:
            "identity_resolution",

          task_status:
            "resolved",

          occurrence_count:
            1,

          latest_dossier_version_id:
            DOSSIER_VERSION_ID,

          latest_occurrence_at:
            null,

          created_at:
            null,

          updated_at:
            null,
        }),
      );

    await listManualReviewTasks(
      {
        subjectId:
          SUBJECT_ID,

        taskStatus:
          "all",

        limit:
          25,
      },
      {
        sql:
          capture.sql,
      },
    );

    const call =
      capture.calls[0];

    assert.equal(
      call.values.includes(
        SUBJECT_ID,
      ),
      true,
    );

    assert.equal(
      call.values.includes(
        null,
      ),
      true,
    );

    assert.equal(
      call.values.includes(
        25,
      ),
      true,
    );
  },
);


test(
  "manual review task list validates filters before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    const invalidInputs = [
      {
        subjectId:
          "not-a-uuid",
      },
      {
        taskStatus:
          "media_review",
      },
      {
        limit:
          0,
      },
      {
        limit:
          201,
      },
    ];

    for (
      const input
      of invalidInputs
    ) {
      await assert.rejects(
        listManualReviewTasks(
          input,
          {
            sql,
          },
        ),
        TypeError,
      );
    }

    assert.equal(
      calls,
      0,
    );
  },
);


test(
  "manual review task status update explicitly changes status and updated_at",
  async () => {
    const taskId =
      "77777777-7777-4777-8777-777777777777";

    const capture =
      capturedSql(
        (call) => ({
          id:
            taskId,

          subject_id:
            SUBJECT_ID,

          source_path:
            "related_people.items",

          item_ref:
            RELATED_REF,

          review_type:
            "identity_resolution",

          task_status:
            call.values[0],

          created_at:
            "2026-08-12T07:00:00.000Z",

          updated_at:
            "2026-08-12T09:00:00.000Z",
        }),
      );

    const task =
      await setManualReviewTaskStatus(
        {
          taskId,

          taskStatus:
            "resolved",
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
      /UPDATE manual_review_tasks/,
    );

    assert.match(
      call.text,
      /updated_at[\s\S]*now\(\)/,
    );

    assert.equal(
      call.values[0],
      "resolved",
    );

    assert.equal(
      call.values[1],
      taskId,
    );

    assert.equal(
      task.task_status,
      "resolved",
    );

    assert.equal(
      task.updated_at,
      "2026-08-12T09:00:00.000Z",
    );

    assert.equal(
      "occurrence_count" in task,
      false,
    );

    assert.equal(
      "latest_dossier_version_id" in task,
      false,
    );

    assert.equal(
      "latest_occurrence_at" in task,
      false,
    );
  },
);


test(
  "manual review task status update permits explicit analyst reopen",
  async () => {
    const taskId =
      "88888888-8888-4888-8888-888888888888";

    const capture =
      capturedSql(
        (call) => ({
          id:
            taskId,

          subject_id:
            SUBJECT_ID,

          source_path:
            "relations.items",

          item_ref:
            RELATION_REF,

          review_type:
            "identity_resolution",

          task_status:
            call.values[0],

          created_at:
            null,

          updated_at:
            null,
        }),
      );

    const task =
      await setManualReviewTaskStatus(
        {
          taskId,

          taskStatus:
            "open",
        },
        {
          sql:
            capture.sql,
        },
      );

    assert.equal(
      task.task_status,
      "open",
    );
  },
);


test(
  "manual review task status update returns null for missing task",
  async () => {
    const sql =
      async () =>
        [];

    const task =
      await setManualReviewTaskStatus(
        {
          taskId:
            "99999999-9999-4999-8999-999999999999",

          taskStatus:
            "dismissed",
        },
        {
          sql,
        },
      );

    assert.equal(
      task,
      null,
    );
  },
);


test(
  "manual review task status update validates input before database access",
  async () => {
    let calls = 0;

    const sql =
      async () => {
        calls += 1;
        return [];
      };

    await assert.rejects(
      setManualReviewTaskStatus(
        {
          taskId:
            "not-a-uuid",

          taskStatus:
            "resolved",
        },
        {
          sql,
        },
      ),
      TypeError,
    );

    await assert.rejects(
      setManualReviewTaskStatus(
        {
          taskId:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

          taskStatus:
            "fetch_failed",
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
