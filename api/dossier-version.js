import {
  isPortalAuthenticated,
} from "../src/auth.js";

import {
  loadDossierVersionById,
  loadLatestDossierVersion,
} from "../src/dossier-version-store.js";


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


export function createDossierVersionHandler(
  options = {},
) {
  const isAuthenticated =
    options.isAuthenticated ??
    isPortalAuthenticated;

  const loadLatest =
    options.loadLatest ??
    loadLatestDossierVersion;

  const loadById =
    options.loadById ??
    loadDossierVersionById;

  return async function handler(
    request,
    response,
  ) {
    response.setHeader(
      "Cache-Control",
      "no-store",
    );

    if (
      request.method !== "GET"
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

    const subjectId =
      request.query
        ?.subjectId ??
      null;

    const dossierVersionId =
      request.query
        ?.dossierVersionId ??
      null;

    const hasSubjectId =
      subjectId != null &&
      String(subjectId)
        .trim() !== "";

    const hasVersionId =
      dossierVersionId != null &&
      String(dossierVersionId)
        .trim() !== "";

    if (
      hasSubjectId ===
      hasVersionId
    ) {
      return badRequest(
        response,
        "Provide exactly one of subjectId or dossierVersionId",
      );
    }

    try {
      const dossierVersion =
        hasSubjectId
          ? await loadLatest({
              subjectId,
            })
          : await loadById({
              dossierVersionId,
            });

      if (!dossierVersion) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "Dossier version not found",
          });
      }

      return response
        .status(200)
        .json({
          ok: true,
          dossierVersion,
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
            "Failed to load dossier version",
        });
    }
  };
}


export default
  createDossierVersionHandler();
