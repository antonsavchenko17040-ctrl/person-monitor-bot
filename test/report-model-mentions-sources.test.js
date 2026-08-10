import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMentionsSection,
  buildSourcesSection,
  buildSubjectReportModel,
} from "../src/report-model.js";

import {
  loadReportSourceDocuments,
} from "../src/source-documents-context.js";

test(
  "mentions expose public match data without internal fingerprint",
  () => {
    const section =
      buildMentionsSection({
        rows: [{
          id:
            "mention-1",

          subject_id:
            "subject-internal",

          entity_id:
            "entity-internal",

          fingerprint:
            "internal-fingerprint",

          provider:
            "google",

          source:
            "Example News",

          title:
            "Заголовок",

          snippet:
            "Фрагмент",

          url:
            "https://example.test/news",

          published_at:
            "2026-08-01T10:00:00.000Z",

          first_seen_at:
            "2026-08-02T10:00:00.000Z",

          match_score:
            91,

          match_level:
            "confirmed",

          reasons: [
            "name",
            "position",
          ],

          source_document_id:
            "doc-1",
        }],
      });

    assert.equal(
      section.total,
      1,
    );

    assert.equal(
      section.items[0]
        .source_document_id,
      "doc-1",
    );

    assert.equal(
      section.items[0]
        .source,
      "Example News",
    );

    assert.equal(
      Object.hasOwn(
        section.items[0],
        "fingerprint",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        section.items[0],
        "subject_id",
      ),
      false,
    );
  },
);

test(
  "sources expose normalized provenance without raw payload",
  () => {
    const section =
      buildSourcesSection({
        rows: [
          {
            id:
              "doc-1",

            source_type:
              "mention",

            source_name:
              "Example Source",

            external_id:
              "external-1",

            title:
              "Source title",

            url:
              "https://example.test/source",

            published_at:
              "2026-08-01T10:00:00.000Z",

            fetched_at:
              "2026-08-02T10:00:00.000Z",

            raw_payload: {
              secret:
                "must-not-leak",
            },
          },

          {
            id:
              "doc-1",

            source_type:
              "mention",

            source_name:
              "Example Source",
          },
        ],
      });

    assert.equal(
      section.items.length,
      1,
    );

    assert.deepEqual(
      section.items[0],
      {
        source_document_id:
          "doc-1",

        source_type:
          "mention",

        provider:
          "Example Source",

        external_id:
          "external-1",

        title:
          "Source title",

        url:
          "https://example.test/source",

        published_at:
          "2026-08-01T10:00:00.000Z",

        observed_at:
          "2026-08-02T10:00:00.000Z",
      },
    );

    assert.equal(
      Object.hasOwn(
        section.items[0],
        "raw_payload",
      ),
      false,
    );
  },
);


test(
  "report loader wires mentions and sources into canonical payload",
  async () => {
    const report =
      await buildSubjectReportModel(
        "subject-1",
        {
          subjectLoader:
            async () => ({
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",
            }),

          declarationYearsLoader:
            async () => [],

          mentionsLoader:
            async () => [{
              id:
                "mention-1",

              provider:
                "google",

              source:
                "Example News",

              title:
                "Заголовок",

              url:
                "https://example.test/news",

              match_score:
                90,

              match_level:
                "confirmed",

              reasons: [],
            }],

          sourceDocumentsLoader:
            async () => [{
              id:
                "doc-1",

              source_type:
                "mention",

              source_name:
                "Example News",

              url:
                "https://example.test/source",
            }],
        },
      );

    assert.equal(
      report.mentions.total,
      1,
    );

    assert.equal(
      report.sources.items.length,
      1,
    );
  },
);

test(
  "source loader rejects invalid identity without database access",
  async () => {
    assert.deepEqual(
      await loadReportSourceDocuments(
        "",
        "",
      ),
      [],
    );
  },
);
