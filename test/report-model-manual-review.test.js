import test from "node:test";
import assert from "node:assert/strict";


test(
  "report exposes reference-only manual review manifest",
  async () => {
    const reportModel =
      await import(
        "../src/report-model.js"
      );

    assert.equal(
      reportModel
        .MANUAL_REVIEW_MANIFEST_VERSION,
      "manual-review-manifest-v1",
    );

    const reviewedRef =
      "related-person-ref-v1:" +
      "a".repeat(64);

    const notRequiredRef =
      "related-person-ref-v1:" +
      "b".repeat(64);

    const report =
      reportModel
        .buildSubjectReportModelPayload({
          subject: {
            id:
              "11111111-1111-4111-8111-111111111111",

            full_name:
              "Тестовий Суб’єкт",
          },

          relatedPeople: {
            items: [
              {
                item_ref:
                  reviewedRef,

                full_name:
                  "СЕКРЕТНЕ ІМЯ ДЛЯ REVIEW",

                relation_type:
                  "family_member",

                review_required:
                  true,

                source_identity: {
                  source_system:
                    "nazk",

                  source_person_ref:
                    "person-secret",
                },

                evidence: [{
                  source_document_id:
                    "source-secret",

                  url:
                    "https://secret.example/review",
                }],
              },

              {
                item_ref:
                  notRequiredRef,

                full_name:
                  "НЕ ПОТРЕБУЄ REVIEW",

                review_required:
                  false,
              },

              {
                item_ref:
                  null,

                full_name:
                  "НЕМАЄ СТАБІЛЬНОГО REF",

                review_required:
                  true,
              },
            ],
          },
        });

    assert.deepEqual(
      report.manual_review,
      {
        version:
          "manual-review-manifest-v1",

        items: [{
          source_path:
            "related_people.items",

          item_ref:
            reviewedRef,

          review_type:
            "identity_resolution",
        }],
      },
    );

    assert.equal(
      report
        .methodology
        .manual_review_manifest_version,
      reportModel
        .MANUAL_REVIEW_MANIFEST_VERSION,
    );

    const serialized =
      JSON.stringify(
        report.manual_review,
      );

    for (
      const forbidden
      of [
        "СЕКРЕТНЕ ІМЯ ДЛЯ REVIEW",
        "НЕ ПОТРЕБУЄ REVIEW",
        "НЕМАЄ СТАБІЛЬНОГО REF",
        "person-secret",
        "source-secret",
        "https://secret.example/review",
      ]
    ) {
      assert.equal(
        serialized.includes(
          forbidden,
        ),
        false,
      );
    }
  },
);



test(
  "manual review manifest deduplicates references and ignores non-human review states",
  async () => {
    const reportModel =
      await import(
        "../src/report-model.js"
      );

    const validRef =
      "related-person-ref-v1:" +
      "c".repeat(64);

    const notRequiredRef =
      "related-person-ref-v1:" +
      "d".repeat(64);

    const manifest =
      reportModel
        .buildManualReviewManifest({
          relatedPeople: {
            items: [
              {
                item_ref:
                  validRef,

                review_required:
                  true,
              },

              {
                item_ref:
                  validRef,

                review_required:
                  true,
              },

              {
                item_ref:
                  "related-person-ref-v1:not-a-valid-hash",

                review_required:
                  true,
              },

              {
                item_ref:
                  null,

                review_required:
                  true,

                full_name:
                  "PII MUST NOT BECOME FALLBACK",
              },

              {
                item_ref:
                  notRequiredRef,

                review_required:
                  false,
              },
            ],
          },
        });

    assert.deepEqual(
      manifest.items,
      [{
        source_path:
          "related_people.items",

        item_ref:
          validRef,

        review_type:
          "identity_resolution",
      }],
    );
  },
);


test(
  "media review status does not create human manual review item",
  async () => {
    const reportModel =
      await import(
        "../src/report-model.js"
      );

    const report =
      reportModel
        .buildSubjectReportModelPayload({
          subject: {
            id:
              "22222222-2222-4222-8222-222222222222",

            full_name:
              "Тестовий Суб’єкт",
          },

          mentions: {
            items: [{
              review_status:
                "fetch_failed",

              identity_level:
                "probable",
            }],
          },
        });

    assert.deepEqual(
      report.manual_review,
      {
        version:
          "manual-review-manifest-v1",

        items: [],
      },
    );
  },
);
