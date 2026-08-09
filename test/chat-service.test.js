import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponsesRequest,
  createSubjectChatResponse,
  normalizeChatHistory,
} from "../src/chat-service.js";

test(
  "normalizes chat history",
  () => {
    const history =
      normalizeChatHistory([
        {
          role: "system",
          content: "ignore",
        },
        {
          role: "user",
          content: "Перше питання",
        },
        {
          role: "assistant",
          content: "Перша відповідь",
        },
      ]);

    assert.equal(
      history.length,
      2,
    );

    assert.equal(
      history[0].role,
      "user",
    );

    assert.equal(
      history[1].role,
      "assistant",
    );
  },
);

test(
  "builds stateless Responses API request",
  () => {
    const request =
      buildResponsesRequest({
        question:
          "Який був дохід?",
        model:
          "test-model",

        context: {
          subject: {
            full_name:
              "Тестова Особа",
          },

          source_documents: [
            {
              id: "doc-1",

              raw_payload: {
                public_field:
                  "PUBLIC_OPEN_DATA",
              },
            },
          ],
        },
      });

    assert.equal(
      request.model,
      "test-model",
    );

    assert.equal(
      request.store,
      false,
    );

    assert.equal(
      Array.isArray(
        request.input,
      ),
      true,
    );

    const serialized =
      JSON.stringify(request);

    assert.match(
      serialized,
      /Тестова Особа/,
    );

    assert.doesNotMatch(
      serialized,
      /PUBLIC_OPEN_DATA/,
    );

    assert.match(
      serialized,
      /raw_payload_available/,
    );

    assert.match(
      serialized,
      /raw_payload_chars/,
    );
  },
);

test(
  "calls Responses API through injected client",
  async () => {
    let capturedRequest = null;

    const fakeClient = {
      responses: {
        async create(request) {
          capturedRequest =
            request;

          return {
            output_text:
              "Тестова відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 2,
        relations: 1,
        mentions: 0,
        cross_checks: 0,
        source_documents: 1,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "income",
          value_number:
            100,
        },
      ],
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Який дохід у 2025?",

        client:
          fakeClient,

        model:
          "test-model",

        knowledgeLoader:
          async () =>
            fakeKnowledge,

        retriever:
          () =>
            fakeContext,
      });

    assert.equal(
      result.answer,
      "Тестова відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval
        .detected_years[0],
      2025,
    );

    assert.ok(
      capturedRequest,
    );

    assert.equal(
      capturedRequest.store,
      false,
    );
  },
);


test(
  "fetches full source document through tool loop",
  async () => {
    const requests = [];

    const fakeClient = {
      responses: {
        async create(request) {
          requests.push(request);

          if (requests.length === 1) {
            const serialized =
              JSON.stringify(request);

            assert.doesNotMatch(
              serialized,
              /PUBLIC_RAW_VALUE/,
            );

            return {
              output_text: "",

              output: [
                {
                  type:
                    "function_call",

                  name:
                    "get_source_document",

                  call_id:
                    "call-source-1",

                  arguments:
                    JSON.stringify({
                      source_document_id:
                        "doc-1",
                    }),
                },
              ],
            };
          }

          if (requests.length === 2) {
            const toolOutput =
              request.input.find(
                (item) =>
                  item.type ===
                    "function_call_output" &&
                  item.call_id ===
                    "call-source-1",
              );

            assert.ok(
              toolOutput,
            );

            assert.match(
              toolOutput.output,
              /PUBLIC_RAW_VALUE/,
            );

            assert.match(
              toolOutput.output,
              /doc-1/,
            );

            return {
              output: [],

              output_text:
                "Повний документ отримано.",
            };
          }

          throw new Error(
            "UNEXPECTED_OPENAI_CALL",
          );
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 1,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 1,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "income",

          value_number:
            100,

          source_document_id:
            "doc-1",
        },
      ],

      relations: [],
      mentions: [],
      cross_checks: [],

      source_documents: [
        {
          id:
            "doc-1",

          title:
            "Тестова декларація",

          url:
            "https://example.test/document",

          raw_payload: {
            field:
              "PUBLIC_RAW_VALUE",
          },
        },
      ],
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Перевір повний документ.",

        client:
          fakeClient,

        model:
          "test-model",

        knowledgeLoader:
          async () =>
            fakeKnowledge,

        retriever:
          () =>
            fakeContext,
      });

    assert.equal(
      requests.length,
      2,
    );

    assert.equal(
      result.answer,
      "Повний документ отримано.",
    );
  },
);
