import OpenAI from "openai";

import {
  CHAT_SERVICE_LIMITS,
  createSubjectChatResponse,
} from "./chat-service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRequestBody(
  request,
) {
  const body =
    request?.body;

  if (
    body === undefined ||
    body === null ||
    body === ""
  ) {
    return {};
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(
      body.toString("utf8"),
    );
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  if (
    typeof body === "object" &&
    !Array.isArray(body)
  ) {
    return body;
  }

  throw new Error(
    "INVALID_JSON_BODY",
  );
}

export function resolveChatProviderConfig(
  env = process.env,
) {
  const provider =
    String(
      env.CHAT_PROVIDER ??
      "",
    )
      .trim()
      .toLowerCase();

  if (provider === "ollama") {
    return {
      provider:
        "ollama",

      apiKey:
        "ollama",

      baseURL:
        String(
          env.OLLAMA_BASE_URL ??
          "http://127.0.0.1:11434/v1",
        ).trim(),

      model:
        String(
          env.OLLAMA_CHAT_MODEL ??
          "qwen3:4b-instruct",
        ).trim(),
    };
  }

  if (provider === "openai") {
    const apiKey =
      String(
        env.OPENAI_API_KEY ??
        "",
      ).trim();

    if (!apiKey) {
      return null;
    }

    return {
      provider:
        "openai",

      apiKey,

      baseURL:
        null,

      model:
        String(
          env.OPENAI_CHAT_MODEL ??
          "",
        ).trim() ||
        undefined,
    };
  }

  return null;
}

function sendJson(
  response,
  status,
  payload,
) {
  return response
    .status(status)
    .json(payload);
}

export function createChatApiHandler({
  env = process.env,

  clientFactory =
    (config) =>
      new OpenAI({
        apiKey:
          config.apiKey,

        ...(
          config.baseURL
            ? {
                baseURL:
                  config.baseURL,
              }
            : {}
        ),
      }),

  chatResponder =
    createSubjectChatResponse,
} = {}) {
  return async function chatApiHandler(
    request,
    response,
  ) {
    response.setHeader(
      "Cache-Control",
      "no-store",
    );

    if (
      request.method !== "POST"
    ) {
      return sendJson(
        response,
        405,
        {
          ok: false,
          error:
            "Method not allowed",
        },
      );
    }

    if (
      String(
        env.CHAT_API_ENABLED ??
        "",
      ).toLowerCase() !==
      "true"
    ) {
      return sendJson(
        response,
        503,
        {
          ok: false,
          error:
            "Chat API disabled",
        },
      );
    }

    const providerConfig =
      resolveChatProviderConfig(
        env,
      );

    if (!providerConfig) {
      return sendJson(
        response,
        503,
        {
          ok: false,
          error:
            "Chat API not configured",
        },
      );
    }

    let body;

    try {
      body =
        parseRequestBody(
          request,
        );
    } catch {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Invalid JSON body",
        },
      );
    }

    const subjectId =
      String(
        body.subjectId ??
        "",
      ).trim();

    if (
      !UUID_RE.test(
        subjectId,
      )
    ) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Invalid subjectId",
        },
      );
    }

    if (
      typeof body.message !==
      "string"
    ) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Invalid message",
        },
      );
    }

    const message =
      body.message.trim();

    if (!message) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Message required",
        },
      );
    }

    if (
      message.length >
      CHAT_SERVICE_LIMITS
        .messageChars
    ) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Message too long",
        },
      );
    }

    const history =
      body.history ??
      [];

    if (
      !Array.isArray(history)
    ) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Invalid history",
        },
      );
    }

    try {
      const client =
        clientFactory(
          providerConfig,
        );

      const result =
        await chatResponder({
          subjectId,
          message,
          history,
          client,

          model:
            providerConfig.model,
        });

      return sendJson(
        response,
        200,
        {
          ok: true,

          ...result,
        },
      );
    } catch (error) {
      if (
        error?.message ===
        "SUBJECT_NOT_FOUND"
      ) {
        return sendJson(
          response,
          404,
          {
            ok: false,
            error:
              "Subject not found",
          },
        );
      }

      console.error(
        "Chat API failed:",
        error,
      );

      return sendJson(
        response,
        502,
        {
          ok: false,
          error:
            "Chat service failed",
        },
      );
    }
  };
}
