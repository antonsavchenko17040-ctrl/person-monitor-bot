import test from "node:test";
import assert from "node:assert/strict";

import {
  createChatApiHandler,
  resolveChatProviderConfig,
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
  "resolves local Ollama provider",
  () => {
    const config =
      resolveChatProviderConfig({
        CHAT_PROVIDER:
          "ollama",
      });

    assert.equal(
      config.provider,
      "ollama",
    );

    assert.equal(
      config.baseURL,
      "http://127.0.0.1:11434/v1",
    );

    assert.equal(
      config.model,
      "qwen3:4b-instruct",
    );
  },
);

test(
  "OpenAI provider requires API key",
  () => {
    const config =
      resolveChatProviderConfig({
        CHAT_PROVIDER:
          "openai",
      });

    assert.equal(
      config,
      null,
    );
  },
);

test(
  "returns unavailable chat status when disabled",
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
      200,
    );

    assert.deepEqual(
      response.state.body,
      {
        ok: true,
        available: false,
      },
    );
  },
);

test(
  "returns available chat status when configured",
  async () => {
    const handler =
      createChatApiHandler({
        env: {
          CHAT_API_ENABLED:
            "true",

          CHAT_PROVIDER:
            "ollama",
        },
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
      200,
    );

    assert.deepEqual(
      response.state.body,
      {
        ok: true,
        available: true,
      },
    );
  },
);

test(
  "rejects unsupported methods",
  async () => {
    const handler =
      createChatApiHandler({
        env: {},
      });

    const response =
      createResponse();

    await handler(
      {
        method: "PUT",
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
          CHAT_PROVIDER:
            "ollama",
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
  "requires configured provider when enabled",
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

          CHAT_PROVIDER:
            "ollama",
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
    let receivedConfig =
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

          CHAT_PROVIDER:
            "ollama",

          OLLAMA_BASE_URL:
            "http://127.0.0.1:11434/v1",

          OLLAMA_CHAT_MODEL:
            "test-model",
        },

        clientFactory(
          config,
        ) {
          receivedConfig =
            config;

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
      receivedConfig.provider,
      "ollama",
    );

    assert.equal(
      receivedConfig.apiKey,
      "ollama",
    );

    assert.equal(
      receivedConfig.baseURL,
      "http://127.0.0.1:11434/v1",
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
        "ollama",
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
