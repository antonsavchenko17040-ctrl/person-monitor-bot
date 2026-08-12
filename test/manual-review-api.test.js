import test from "node:test";
import assert from "node:assert/strict";

import {
  createManualReviewHandler,
} from "../api/manual-review.js";


const SUBJECT_ID =
  "11111111-1111-4111-8111-111111111111";

const TASK_ID =
  "22222222-2222-4222-8222-222222222222";


function createResponse() {
  return {
    statusCode:
      null,

    body:
      null,

    headers: {},

    status(code) {
      this.statusCode =
        code;

      return this;
    },

    json(payload) {
      this.body =
        payload;

      return this;
    },

    setHeader(
      name,
      value,
    ) {
      this.headers[name] =
        value;
    },
  };
}


test(
  "authenticated GET lists manual review tasks with filters",
  async () => {
    const calls = [];

    const tasks = [{
      id:
        TASK_ID,

      subject_id:
        SUBJECT_ID,

      source_path:
        "related_people.items",

      item_ref:
        "related-person-ref-v1:" +
        "a".repeat(64),

      review_type:
        "identity_resolution",

      task_status:
        "open",
    }];

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        listTasks:
          async (input) => {
            calls.push(
              input,
            );

            return tasks;
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "GET",

        query: {
          subjectId:
            SUBJECT_ID,

          taskStatus:
            "all",

          limit:
            "25",
        },
      },
      response,
    );

    assert.deepEqual(
      calls,
      [{
        subjectId:
          SUBJECT_ID,

        taskStatus:
          "all",

        limit:
          "25",
      }],
    );

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.body,
      {
        ok: true,
        tasks,
      },
    );

    assert.equal(
      response.headers[
        "Cache-Control"
      ],
      "no-store",
    );
  },
);


test(
  "authenticated GET defaults to open manual review tasks",
  async () => {
    const calls = [];

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        listTasks:
          async (input) => {
            calls.push(
              input,
            );

            return [];
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "GET",

        query: {},
      },
      response,
    );

    assert.deepEqual(
      calls,
      [{
        subjectId:
          null,

        taskStatus:
          "open",

        limit:
          undefined,
      }],
    );

    assert.equal(
      response.statusCode,
      200,
    );
  },
);


test(
  "manual review API rejects unauthenticated request before store access",
  async () => {
    let calls = 0;

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            false,

        listTasks:
          async () => {
            calls +=
              1;

            return [];
          },

        setTaskStatus:
          async () => {
            calls +=
              1;

            return {};
          },
      });

    for (
      const method
      of [
        "GET",
        "PATCH",
      ]
    ) {
      const response =
        createResponse();

      await handler(
        {
          method,
          query: {},
          body: {
            taskId:
              TASK_ID,

            taskStatus:
              "resolved",
          },
        },
        response,
      );

      assert.equal(
        response.statusCode,
        401,
      );
    }

    assert.equal(
      calls,
      0,
    );
  },
);


test(
  "manual review API rejects unsupported method before auth",
  async () => {
    let authCalls = 0;

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () => {
            authCalls +=
              1;

            return true;
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "POST",
      },
      response,
    );

    assert.equal(
      authCalls,
      0,
    );

    assert.equal(
      response.statusCode,
      405,
    );
  },
);


test(
  "authenticated PATCH updates explicit manual review status",
  async () => {
    const calls = [];

    const task = {
      id:
        TASK_ID,

      subject_id:
        SUBJECT_ID,

      task_status:
        "resolved",
    };

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        setTaskStatus:
          async (input) => {
            calls.push(
              input,
            );

            return task;
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "PATCH",

        body: {
          taskId:
            TASK_ID,

          taskStatus:
            "resolved",
        },
      },
      response,
    );

    assert.deepEqual(
      calls,
      [{
        taskId:
          TASK_ID,

        taskStatus:
          "resolved",
      }],
    );

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.body,
      {
        ok: true,
        task,
      },
    );
  },
);


test(
  "authenticated PATCH accepts JSON string body",
  async () => {
    const calls = [];

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        setTaskStatus:
          async (input) => {
            calls.push(
              input,
            );

            return {
              id:
                TASK_ID,

              task_status:
                input.taskStatus,
            };
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "PATCH",

        body:
          JSON.stringify({
            taskId:
              TASK_ID,

            taskStatus:
              "dismissed",
          }),
      },
      response,
    );

    assert.deepEqual(
      calls,
      [{
        taskId:
          TASK_ID,

        taskStatus:
          "dismissed",
      }],
    );

    assert.equal(
      response.statusCode,
      200,
    );
  },
);


test(
  "authenticated PATCH rejects copied non-reference fields",
  async () => {
    let calls = 0;

    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        setTaskStatus:
          async () => {
            calls +=
              1;

            return {};
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "PATCH",

        body: {
          taskId:
            TASK_ID,

          taskStatus:
            "resolved",

          full_name:
            "Sensitive copied data",
        },
      },
      response,
    );

    assert.equal(
      calls,
      0,
    );

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      JSON.stringify(
        response.body,
      ).includes(
        "Sensitive copied data",
      ),
      false,
    );
  },
);


test(
  "authenticated PATCH maps missing task to 404",
  async () => {
    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        setTaskStatus:
          async () =>
            null,
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "PATCH",

        body: {
          taskId:
            TASK_ID,

          taskStatus:
            "resolved",
        },
      },
      response,
    );

    assert.equal(
      response.statusCode,
      404,
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Manual review task not found",
      },
    );
  },
);


test(
  "manual review API maps validation errors to 400",
  async () => {
    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        listTasks:
          async () => {
            throw new TypeError(
              "taskStatus must be open, resolved, or dismissed",
            );
          },

        setTaskStatus:
          async () => {
            throw new TypeError(
              "taskId must be a UUID",
            );
          },
      });

    const getResponse =
      createResponse();

    await handler(
      {
        method:
          "GET",

        query: {
          taskStatus:
            "bad-status",
        },
      },
      getResponse,
    );

    assert.equal(
      getResponse.statusCode,
      400,
    );

    const patchResponse =
      createResponse();

    await handler(
      {
        method:
          "PATCH",

        body: {
          taskId:
            "bad-id",

          taskStatus:
            "resolved",
        },
      },
      patchResponse,
    );

    assert.equal(
      patchResponse.statusCode,
      400,
    );
  },
);


test(
  "manual review API hides unexpected internal errors",
  async () => {
    const handler =
      createManualReviewHandler({
        isAuthenticated:
          () =>
            true,

        listTasks:
          async () => {
            throw new Error(
              "DATABASE_URL=secret list failure",
            );
          },

        setTaskStatus:
          async () => {
            throw new Error(
              "DATABASE_URL=secret update failure",
            );
          },
      });

    const getResponse =
      createResponse();

    const originalError =
      console.error;

    console.error =
      () => {};

    try {
      await handler(
        {
          method:
            "GET",

          query: {},
        },
        getResponse,
      );

      assert.equal(
        getResponse.statusCode,
        500,
      );

      assert.equal(
        JSON.stringify(
          getResponse.body,
        ).includes(
          "DATABASE_URL",
        ),
        false,
      );

      const patchResponse =
        createResponse();

      await handler(
        {
          method:
            "PATCH",

          body: {
            taskId:
              TASK_ID,

            taskStatus:
              "resolved",
          },
        },
        patchResponse,
      );

      assert.equal(
        patchResponse.statusCode,
        500,
      );

      assert.equal(
        JSON.stringify(
          patchResponse.body,
        ).includes(
          "DATABASE_URL",
        ),
        false,
      );
    } finally {
      console.error =
        originalError;
    }
  },
);
