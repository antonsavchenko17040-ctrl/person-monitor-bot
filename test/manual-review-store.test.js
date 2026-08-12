import assert from "node:assert/strict";
import test from "node:test";

import {
  MANUAL_REVIEW_MANIFEST_VERSION,
} from "../src/manual-review-contract.js";

import {
  MANUAL_REVIEW_STORE_VERSION,
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
