import {
  isPortalAuthenticated,
} from "../src/auth.js";

import {
  listManualReviewTasks,
  setManualReviewTaskStatus,
} from "../src/manual-review-store.js";


function badRequest(
  response,
  message,
) {
  return response
    .status(400)
    .json({
      ok: false,
      error:
        message,
    });
}


function parsePatchBody(
  request,
) {
  let body =
    request.body;

  if (
    typeof body === "string"
  ) {
    try {
      body =
        JSON.parse(
          body,
        );
    } catch {
      throw new TypeError(
        "Invalid JSON body",
      );
    }
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(
      body,
    )
  ) {
    throw new TypeError(
      "Request body must be an object",
    );
  }

  const keys =
    Object.keys(
      body,
    ).sort();

  const expected = [
    "taskId",
    "taskStatus",
  ];

  if (
    keys.length !==
      expected.length ||
    keys.some(
      (key, index) =>
        key !==
          expected[index],
    )
  ) {
    throw new TypeError(
      "PATCH body must contain only taskId and taskStatus",
    );
  }

  return body;
}


export function createManualReviewHandler(
  options = {},
) {
  const isAuthenticated =
    options.isAuthenticated ??
    isPortalAuthenticated;

  const listTasks =
    options.listTasks ??
    listManualReviewTasks;

  const setTaskStatus =
    options.setTaskStatus ??
    setManualReviewTaskStatus;

  return async function handler(
    request,
    response,
  ) {
    response.setHeader(
      "Cache-Control",
      "no-store",
    );

    if (
      request.method !== "GET" &&
      request.method !== "PATCH"
    ) {
      return response
        .status(405)
        .json({
          ok: false,
          error:
            "Method not allowed",
        });
    }

    if (
      !isAuthenticated(
        request,
      )
    ) {
      return response
        .status(401)
        .json({
          ok: false,
          error:
            "Unauthorized",
        });
    }

    if (
      request.method === "GET"
    ) {
      try {
        const tasks =
          await listTasks({
            subjectId:
              request.query
                ?.subjectId ??
              null,

            taskStatus:
              request.query
                ?.taskStatus ??
              "open",

            limit:
              request.query
                ?.limit,
          });

        return response
          .status(200)
          .json({
            ok: true,
            tasks,
          });
      } catch (error) {
        if (
          error instanceof
            TypeError
        ) {
          return badRequest(
            response,
            error.message,
          );
        }

        console.error(
          error,
        );

        return response
          .status(500)
          .json({
            ok: false,
            error:
              "Failed to load manual review tasks",
          });
      }
    }

    let body;

    try {
      body =
        parsePatchBody(
          request,
        );

      const task =
        await setTaskStatus({
          taskId:
            body.taskId,

          taskStatus:
            body.taskStatus,
        });

      if (!task) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "Manual review task not found",
          });
      }

      return response
        .status(200)
        .json({
          ok: true,
          task,
        });
    } catch (error) {
      if (
        error instanceof
          TypeError
      ) {
        return badRequest(
          response,
          error.message,
        );
      }

      console.error(
        error,
      );

      return response
        .status(500)
        .json({
          ok: false,
          error:
            "Failed to update manual review task",
        });
    }
  };
}


export default
  createManualReviewHandler();
