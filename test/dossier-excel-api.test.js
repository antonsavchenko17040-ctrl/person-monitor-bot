import test from "node:test";
import assert from "node:assert/strict";

import {
  createDossierExcelHandler,
} from "../api/dossier-excel.js";


const VERSION_ID =
  "22222222-2222-4222-8222-222222222222";


function createResponse() {
  return {
    statusCode:
      null,

    body:
      null,

    headers: {},

    sent:
      null,

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

    send(payload) {
      this.sent =
        payload;

      return this;
    },

    setHeader(
      name,
      value
    ) {
      this.headers[name] =
        value;
    },
  };
}


test(
  "GET exports exact persisted dossier version",
  async () => {
    const calls = [];

    const input = {
      dossier_version_id:
        VERSION_ID,

      report: {
        subject: {
          full_name:
            "Тестовий Субєкт",
        },
      },
    };

    const model = {
      contract_version:
        "dossier-export-model-v1",
    };

    const buffer =
      Buffer.from(
        "xlsx"
      );

    const handler =
      createDossierExcelHandler({
        loadExportInput:
          async (received) => {
            calls.push({
              step:
                "load",

              received,
            });

            return input;
          },

        buildExportModel:
          (received) => {
            calls.push({
              step:
                "model",

              received,
            });

            return model;
          },

        buildExcel:
          async (received) => {
            calls.push({
              step:
                "excel",

              received,
            });

            return {
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

              filename:
                "Тестовий dossier.xlsx",

              buffer,
            };
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
      response
    );

    assert.deepEqual(
      calls,
      [
        {
          step:
            "load",

          received: {
            dossierVersionId:
              VERSION_ID,
          },
        },

        {
          step:
            "model",

          received:
            input,
        },

        {
          step:
            "excel",

          received:
            model,
        },
      ]
    );

    assert.equal(
      response.statusCode,
      200
    );

    assert.equal(
      response.sent,
      buffer
    );

    assert.equal(
      response.headers[
        "Cache-Control"
      ],
      "no-store"
    );

    assert.equal(
      response.headers[
        "Content-Type"
      ],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    assert.match(
      response.headers[
        "Content-Disposition"
      ],
      /^attachment; filename\*=UTF-8/
    );

    assert.match(
      response.headers[
        "Content-Disposition"
      ],
      /%D0%A2/
    );
  }
);


test(
  "rejects non GET before export access",
  async () => {

    let loadCalls =
      0;

    const handler =
      createDossierExcelHandler({
        loadExportInput:
          async () => {
            loadCalls +=
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
          dossierVersionId:
            VERSION_ID,
        },
      },
      response
    );

    assert.equal(
      response.statusCode,
      405
    );


    assert.equal(
      loadCalls,
      0
    );

    assert.equal(
      response.headers[
        "Cache-Control"
      ],
      "no-store"
    );
  }
);




test(
  "requires exact dossierVersionId selector",
  async () => {
    let loadCalls =
      0;

    const handler =
      createDossierExcelHandler({
        loadExportInput:
          async () => {
            loadCalls +=
              1;

            return null;
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
      response
    );

    assert.equal(
      response.statusCode,
      400
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "dossierVersionId is required",
      }
    );

    assert.equal(
      loadCalls,
      0
    );
  }
);


test(
  "rejects subjectId selector for canonical export",
  async () => {
    let loadCalls =
      0;

    const handler =
      createDossierExcelHandler({
        loadExportInput:
          async () => {
            loadCalls +=
              1;

            return null;
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
            "11111111-1111-4111-8111-111111111111",

          dossierVersionId:
            VERSION_ID,
        },
      },
      response
    );

    assert.equal(
      response.statusCode,
      400
    );

    assert.match(
      response.body.error,
      /subjectId/
    );

    assert.equal(
      loadCalls,
      0
    );
  }
);


test(
  "maps missing persisted dossier version to 404",
  async () => {
    const handler =
      createDossierExcelHandler({
        loadExportInput:
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
      response
    );

    assert.equal(
      response.statusCode,
      404
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Dossier version not found",
      }
    );
  }
);


test(
  "maps invalid dossier version selector to 400",
  async () => {
    const handler =
      createDossierExcelHandler({
        loadExportInput:
          async () => {
            throw new TypeError(
              "Invalid dossierVersionId"
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
          dossierVersionId:
            "invalid",
        },
      },
      response
    );

    assert.equal(
      response.statusCode,
      400
    );

    assert.deepEqual(
      response.body,
      {
        ok: false,
        error:
          "Invalid dossierVersionId",
      }
    );
  }
);


test(
  "does not classify malformed persisted export as client error",
  async () => {
    const originalError =
      console.error;

    console.error =
      () => {};

    try {
      const handler =
        createDossierExcelHandler({
          isAuthenticated:
            () =>
              true,

          loadExportInput:
            async () => ({
              dossier_version_id:
                VERSION_ID,
            }),

          buildExportModel:
            () => {
              throw new TypeError(
                "canonical report is required"
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
            dossierVersionId:
              VERSION_ID,
          },
        },
        response
      );

      assert.equal(
        response.statusCode,
        500
      );

      assert.deepEqual(
        response.body,
        {
          ok: false,
          error:
            "Failed to build dossier Excel export",
        }
      );
    } finally {
      console.error =
        originalError;
    }
  }
);
