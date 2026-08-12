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



test(
  "manual review manifest references timeless EDR human-review relation",
  async () => {
    const reportModel =
      await import(
        "../src/report-model.js"
      );

    const reviewedRelationId =
      "33333333-3333-5333-8333-333333333333";

    const report =
      reportModel
        .buildSubjectReportModelPayload({
          subject: {
            id:
              "44444444-4444-4444-8444-444444444444",

            full_name:
              "Тестовий Суб’єкт",
          },

          relations: {
            items: [
              {
                relation_id:
                  reviewedRelationId,

                relation_type:
                  "edr_founder_of",

                relation_scope:
                  "timeless",

                year:
                  null,

                verification_status:
                  "manual_review",

                metadata: {
                  source:
                    "edr",

                  review_required:
                    true,

                  edr_relation_type:
                    "founder",
                },

                to_name:
                  "СЕКРЕТНА ОРГАНІЗАЦІЯ",

                to_metadata: {
                  edrpou:
                    "12345678",
                },
              },

              {
                relation_id:
                  "55555555-5555-5555-8555-555555555555",

                relation_type:
                  "edr_signer_of",

                relation_scope:
                  "timeless",

                year:
                  null,

                verification_status:
                  "verified",

                metadata: {
                  source:
                    "edr",

                  review_required:
                    false,
                },
              },

              {
                relation_id:
                  "66666666-6666-5666-8666-666666666666",

                relation_type:
                  "edr_member_of",

                relation_scope:
                  "timeless",

                year:
                  null,

                verification_status:
                  "manual_review",

                metadata: {
                  source:
                    "other",

                  review_required:
                    true,
                },
              },

              {
                relation_id:
                  "77777777-7777-5777-8777-777777777777",

                relation_type:
                  "employed_by",

                relation_scope:
                  "direct",

                year:
                  2025,

                verification_status:
                  "manual_review",

                metadata: {
                  source:
                    "edr",

                  review_required:
                    true,
                },
              },

              {
                relation_id:
                  "   ",

                relation_type:
                  "edr_beneficiary_of",

                relation_scope:
                  "timeless",

                year:
                  null,

                verification_status:
                  "manual_review",

                metadata: {
                  source:
                    "edr",

                  review_required:
                    true,
                },
              },

              {
                relation_id:
                  "relation-not-a-uuid",

                relation_type:
                  "edr_beneficiary_of",

                relation_scope:
                  "timeless",

                year:
                  null,

                verification_status:
                  "manual_review",

                metadata: {
                  source:
                    "edr",

                  review_required:
                    true,
                },
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
            "relations.items",

          item_ref:
            reviewedRelationId,

          review_type:
            "identity_resolution",
        }],
      },
    );

    const serialized =
      JSON.stringify(
        report.manual_review,
      );

    for (
      const forbidden
      of [
        "СЕКРЕТНА ОРГАНІЗАЦІЯ",
        "12345678",
        "edr_founder_of",
        "founder",
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
