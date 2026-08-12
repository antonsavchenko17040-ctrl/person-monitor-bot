import test from "node:test";
import assert from "node:assert/strict";

import {
  createDossierVersionHandler,
} from "../api/dossier-version.js";


const SUBJECT_ID =
  "11111111-1111-4111-8111-111111111111";

const VERSION_ID =
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
  "GET loads latest dossier version by subject",
  async () => {
    const calls = [];

    const version = {
      id:
        VERSION_ID,

      subject_id:
        SUBJECT_ID,
    };

    const handler =
      createDossierVersionHandler({
        loadLatest:
          async (input) => {
            calls.push(
              input,
            );

            return version;
          },

        loadById:
          async () => {
            throw new Error(
              "unexpected loadById",
            );
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
        },
      },
      response,
    );

    assert.deepEqual(
      calls,
      [{
        subjectId:
          SUBJECT_ID,
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
        dossierVersion:
          version,
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
  "GET loads dossier version by id",
  async () => {
    const calls = [];

    const version = {
      id:
        VERSION_ID,

      subject_id:
        SUBJECT_ID,
    };

    const handler =
      createDossierVersionHandler({
        loadLatest:
          async () => {
            throw new Error(
              "unexpected loadLatest",
            );
          },

        loadById:
          async (input) => {
            calls.push(
              input,
            );

            return version;
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "GET",

        query: {
          dossierVersionId:
            VERSION_ID,
        },
      },
      response,
    );

    assert.deepEqual(
      calls,
      [{
        dossierVersionId:
          VERSION_ID,
      }],
    );

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.body
        .dossierVersion
        .id,
      VERSION_ID,
    );
  },
);


test(
  "dossier version API rejects unsupported method before store access",
  async () => {
    let storeCalls = 0;

    const handler =
      createDossierVersionHandler({
        loadLatest:
          async () => {
            storeCalls +=
              1;

            return null;
          },
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "POST",

        query: {
          subjectId:
            SUBJECT_ID,
        },
      },
      response,
    );

    assert.equal(
      response.statusCode,
      405,
    );


    assert.equal(
      storeCalls,
      0,
    );
  },
);




test(
  "dossier version API requires exactly one selector",
  async () => {
    let storeCalls = 0;

    const handler =
      createDossierVersionHandler({
        loadLatest:
          async () => {
            storeCalls +=
              1;

            return null;
          },

        loadById:
          async () => {
            storeCalls +=
              1;

            return null;
          },
      });

    for (
      const query
      of [
        {},
        {
          subjectId:
            SUBJECT_ID,

          dossierVersionId:
            VERSION_ID,
        },
      ]
    ) {
      const response =
        createResponse();

      await handler(
        {
          method:
            "GET",

          query,
        },
        response,
      );

      assert.equal(
        response.statusCode,
        400,
      );
    }

    assert.equal(
      storeCalls,
      0,
    );
  },
);


test(
  "dossier version API maps invalid selector to 400",
  async () => {
    const handler =
      createDossierVersionHandler({
        loadLatest:
          async () => {
            throw new TypeError(
              "subjectId must be a UUID",
            );
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
            "invalid",
        },
      },
      response,
    );

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.body.error,
      "subjectId must be a UUID",
    );
  },
);


test(
  "dossier version API returns 404 for missing snapshot",
  async () => {
    const handler =
      createDossierVersionHandler({
        loadById:
          async () =>
            null,
      });

    const response =
      createResponse();

    await handler(
      {
        method:
          "GET",

        query: {
          dossierVersionId:
            VERSION_ID,
        },
      },
      response,
    );

    assert.equal(
      response.statusCode,
      404,
    );

    assert.equal(
      response.body.error,
      "Dossier version not found",
    );
  },
);


test(
  "dossier version API hides unexpected store errors",
  async () => {
    const handler =
      createDossierVersionHandler({
        loadLatest:
          async () => {
            throw new Error(
              "secret database detail",
            );
          },
      });

    const response =
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

          query: {
            subjectId:
              SUBJECT_ID,
          },
        },
        response,
      );
    } finally {
      console.error =
        originalError;
    }

    assert.equal(
      response.statusCode,
      500,
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Failed to load dossier version",
      },
    );
  },
);
