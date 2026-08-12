import {
  loadDossierExportInput,
} from "../src/dossier-export-input.js";

import {
  buildDossierExportModel,
} from "../src/dossier-export-model.js";

import {
  buildDossierExcel,
  DOSSIER_EXCEL_CONTENT_TYPE,
} from "../src/dossier-excel.js";


function badRequest(
  response,
  message
) {
  return response
    .status(400)
    .json({
      ok: false,
      error:
        message,
    });
}


export function createDossierExcelHandler(
  options = {}
) {
  const loadExportInput =
    options.loadExportInput ??
    loadDossierExportInput;

  const buildExportModel =
    options.buildExportModel ??
    buildDossierExportModel;

  const buildExcel =
    options.buildExcel ??
    buildDossierExcel;


  return async function handler(
    request,
    response
  ) {
    response.setHeader(
      "Cache-Control",
      "no-store"
    );

    if (
      request.method !==
      "GET"
    ) {
      return response
        .status(405)
        .json({
          ok: false,
          error:
            "Method not allowed",
        });
    }


    const subjectId =
      request.query
        ?.subjectId ??
      null;

    const dossierVersionId =
      String(
        request.query
          ?.dossierVersionId ??
        ""
      ).trim();

    if (
      subjectId !== null &&
      String(
        subjectId
      ).trim() !==
        ""
    ) {
      return badRequest(
        response,
        "subjectId is not supported for canonical export"
      );
    }

    if (
      !dossierVersionId
    ) {
      return badRequest(
        response,
        "dossierVersionId is required"
      );
    }

    let input;

    try {
      input =
        await loadExportInput({
          dossierVersionId,
        });
    } catch (error) {
      if (
        error instanceof
          TypeError
      ) {
        return badRequest(
          response,
          error.message
        );
      }

      console.error(
        error
      );

      return response
        .status(500)
        .json({
          ok: false,
          error:
            "Failed to load dossier export snapshot",
        });
    }

    if (!input) {
      return response
        .status(404)
        .json({
          ok: false,
          error:
            "Dossier version not found",
        });
    }

    try {
      const model =
        buildExportModel(
          input
        );

      const report =
        await buildExcel(
          model
        );

      const contentType =
        report.contentType ??
        DOSSIER_EXCEL_CONTENT_TYPE;

      const encodedFilename =
        encodeURIComponent(
          report.filename
        );

      const apostrophe =
        String.fromCharCode(
          39
        );

      response.setHeader(
        "Content-Type",
        contentType
      );

      response.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8${apostrophe}${apostrophe}${encodedFilename}`
      );

      return response
        .status(200)
        .send(
          report.buffer
        );
    } catch (error) {
      console.error(
        error
      );

      return response
        .status(500)
        .json({
          ok: false,
          error:
            "Failed to build dossier Excel export",
        });
    }
  };
}


export default
  createDossierExcelHandler();
