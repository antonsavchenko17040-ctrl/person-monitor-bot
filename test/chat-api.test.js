import test from "node:test";
import assert from "node:assert/strict";

import {
  createChatApiHandler,
} from "../src/chat-api.js";

function createResponse() {
  const state = {
    status: null,
    body: null,
    headers: {},
  };

  return {
    state,

    setHeader(
      name,
      value,
    ) {
      state.headers[name] =
        value;
    },

    status(code) {
      state.status =
        code;

      return this;
    },

    json(payload) {
      state.body =
        payload;

      return this;
    },
  };
}

test(
  "rejects non-POST requests",
  async () => {
    const handler =
      createChatApiHandler({
        env: {},
      });

    const response =
      createResponse();

    await handler(
      {
        method: "GET",
      },
      response,
    );

    assert.equal(
      response.state.status,
      405,
    );
  },
);

test(
  "chat API is disabled by default",
  async () => {
    const handler =
      createChatApiHandler({
        env: {
          OPENAI_API_KEY:
            "test-key",
        },
      });

    const response =
      createResponse();

    await handler(
      {
        method: "POST",
        body: {},
      },
      response,
    );

    assert.equal(
      response.state.status,
      503,
    );

    assert.equal(
      response.state.body.error,
      "Chat API disabled",
    );
  },
);

test(
  "requires API key when enabled",
  async () => {
    const handler =
      createChatApiHandler({
        env: {
          CHAT_API_ENABLED:
            "true",
        },
      });

    const response =
      createResponse();

    await handler(
      {
        method: "POST",
        body: {},
      },
      response,
    );

    assert.equal(
      response.state.status,
      503,
    );

    assert.equal(
      response.state.body.error,
      "Chat API not configured",
    );
  },
);

test(
  "rejects invalid subject id",
  async () => {
    const handler =
      createChatApiHandler({
        env: {
          CHAT_API_ENABLED:
            "true",

          OPENAI_API_KEY:
            "test-key",
        },
      });

    const response =
      createResponse();

    await handler(
      {
        method: "POST",

        body: {
          subjectId:
            "not-a-uuid",

          message:
            "Тест",
        },
      },
      response,
    );

    assert.equal(
      response.state.status,
      400,
    );

    assert.equal(
      response.state.body.error,
      "Invalid subjectId",
    );
  },
);

test(
  "returns chat response through injected service",
  async () => {
    let receivedApiKey =
      null;

    let receivedRequest =
      null;

    const fakeClient = {
      fake: true,
    };

    const handler =
      createChatApiHandler({
        env: {
          CHAT_API_ENABLED:
            "true",

          OPENAI_API_KEY:
            "SECRET_TEST_KEY",

          OPENAI_CHAT_MODEL:
            "test-model",
        },

        clientFactory(
          apiKey,
        ) {
          receivedApiKey =
            apiKey;

          return fakeClient;
        },

        async chatResponder(
          input,
        ) {
          receivedRequest =
            input;

          return {
            answer:
              "Тестова відповідь",

            model:
              input.model,

            retrieval: {
              version:
                "subject-retrieval-v1",

              detected_years:
                [2025],

              counts: {
                facts: 1,
              },
            },
          };
        },
      });

    const response =
      createResponse();

    await handler(
      {
        method: "POST",

        body: {
          subjectId:
            "d0ea8877-0d55-4d54-8eef-7f4cb288553f",

          message:
            "Який дохід у 2025 році?",

          history: [
            {
              role: "user",
              content:
                "Попереднє питання",
            },
          ],
        },
      },
      response,
    );

    assert.equal(
      response.state.status,
      200,
    );

    assert.equal(
      response.state.body.ok,
      true,
    );

    assert.equal(
      response.state.body.answer,
      "Тестова відповідь",
    );

    assert.equal(
      receivedApiKey,
      "SECRET_TEST_KEY",
    );

    assert.equal(
      receivedRequest.client,
      fakeClient,
    );

    assert.equal(
      receivedRequest.model,
      "test-model",
    );

    assert.equal(
      JSON.stringify(
        response.state.body,
      ).includes(
        "SECRET_TEST_KEY",
      ),
      false,
    );

    assert.equal(
      response.state.headers[
        "Cache-Control"
      ],
      "no-store",
    );
  },
);
