import test from "node:test";
import assert from "node:assert/strict";

import {
  createDossierHandler,
} from "../api/dossier.js";

function createResponse() {
  return {
    statusCode: null,
    body: null,
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

    setHeader(name, value) {
      this.headers[name] =
        value;
    },
  };
}

test(
  "authenticated POST runs unified dossier workflow",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const dossier = {
      version:
        "dossier-orchestrator-v1",

      status:
        "completed",

      subject: {
        id:
          subjectId,
      },

      refresh: {
        scanned:
          2,
      },

      report: {
        schema_version:
          "report-model-v1",
      },

      errors: [],
    };

    const calls = [];

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            true,

        runDossier:
          async (receivedSubjectId) => {
            calls.push(
              receivedSubjectId,
            );

            return dossier;
          },
      });

    const request = {
      method:
        "POST",

      query: {
        subjectId,
      },
    };

    const response =
      createResponse();

    await handler(
      request,
      response,
    );

    assert.deepEqual(
      calls,
      [
        subjectId,
      ],
    );

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.body,
      {
        ok: true,
        dossier,
      },
    );

    assert.equal(
      response.headers["Cache-Control"],
      "no-store",
    );
  },
);


test(
  "rejects unauthenticated dossier request",
  async () => {
    let runCalled =
      false;

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            false,

        runDossier:
          async () => {
            runCalled =
              true;

            throw new Error(
              "workflow must not run",
            );
          },
      });

    const request = {
      method:
        "POST",

      query: {
        subjectId:
          "11111111-1111-4111-8111-111111111111",
      },
    };

    const response =
      createResponse();

    await handler(
      request,
      response,
    );

    assert.equal(
      runCalled,
      false,
    );

    assert.equal(
      response.statusCode,
      401,
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Unauthorized",
      },
    );
  },
);


test(
  "rejects non POST dossier request",
  async () => {
    let runCalled =
      false;

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            true,

        runDossier:
          async () => {
            runCalled =
              true;

            throw new Error(
              "workflow must not run",
            );
          },
      });

    const request = {
      method:
        "GET",

      query: {
        subjectId:
          "11111111-1111-4111-8111-111111111111",
      },
    };

    const response =
      createResponse();

    await handler(
      request,
      response,
    );

    assert.equal(
      runCalled,
      false,
    );

    assert.equal(
      response.statusCode,
      405,
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Method not allowed",
      },
    );
  },
);


test(
  "rejects invalid dossier subject id",
  async () => {
    let runCalled =
      false;

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            true,

        runDossier:
          async () => {
            runCalled =
              true;

            throw new Error(
              "workflow must not run",
            );
          },
      });

    const request = {
      method:
        "POST",

      query: {
        subjectId:
          "not-a-uuid",
      },
    };

    const response =
      createResponse();

    await handler(
      request,
      response,
    );

    assert.equal(
      runCalled,
      false,
    );

    assert.equal(
      response.statusCode,
      400,
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Invalid subjectId",
      },
    );
  },
);


test(
  "maps missing dossier subject to 404",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const dossier = {
      version:
        "dossier-orchestrator-v1",

      status:
        "failed",

      subject:
        null,

      refresh:
        null,

      report:
        null,

      errors: [
        {
          step:
            "subject",

          code:
            "subject_not_found",

          message:
            "Subject not found",
        },
      ],

      steps: {
        subject: {
          status:
            "failed",
        },

        refresh: {
          status:
            "skipped",
        },

        report: {
          status:
            "skipped",
        },
      },
    };

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            true,

        runDossier:
          async () =>
            dossier,
      });

    const request = {
      method:
        "POST",

      query: {
        subjectId,
      },
    };

    const response =
      createResponse();

    await handler(
      request,
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
          "Subject not found",
        dossier,
      },
    );
  },
);


test(
  "returns safe 500 when dossier workflow throws",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            true,

        runDossier:
          async () => {
            throw new Error(
              "DATABASE_URL=secret internal failure",
            );
          },
      });

    const request = {
      method:
        "POST",

      query: {
        subjectId,
      },
    };

    const response =
      createResponse();

    await handler(
      request,
      response,
    );

    assert.equal(
      response.statusCode,
      500,
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Failed to build dossier",
      },
    );

    assert.equal(
      JSON.stringify(
        response.body,
      ).includes(
        "DATABASE_URL",
      ),
      false,
    );

    assert.equal(
      JSON.stringify(
        response.body,
      ).includes(
        "secret internal failure",
      ),
      false,
    );
  },
);


test(
  "returns partial dossier as successful 200 response",
  async () => {
    const subjectId =
      "11111111-1111-4111-8111-111111111111";

    const dossier = {
      version:
        "dossier-orchestrator-v1",

      status:
        "partial",

      subject: {
        id:
          subjectId,
      },

      refresh:
        null,

      report: {
        schema_version:
          "report-model-v1",
      },

      errors: [
        {
          step:
            "refresh",

          code:
            "refresh_failed",

          message:
            "refresh unavailable",
        },
      ],

      steps: {
        subject: {
          status:
            "completed",
        },

        refresh: {
          status:
            "failed",
        },

        report: {
          status:
            "completed",
        },
      },
    };

    const handler =
      createDossierHandler({
        isAuthenticated:
          () =>
            true,

        runDossier:
          async () =>
            dossier,
      });

    const request = {
      method:
        "POST",

      query: {
        subjectId,
      },
    };

    const response =
      createResponse();

    await handler(
      request,
      response,
    );

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.body,
      {
        ok: true,
        dossier,
      },
    );

    assert.equal(
      response.headers["Cache-Control"],
      "no-store",
    );
  },
);
