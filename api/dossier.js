import {
  runSubjectDossier,
} from "../src/dossier-orchestrator.js";

import {
  saveDossierVersion,
} from "../src/dossier-version-store.js";

import {
  syncManualReviewTasks,
} from "../src/manual-review-store.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDossierHandler(
  options = {},
) {
  const orchestrateDossier =
    options.orchestrateDossier ??
    runSubjectDossier;

  const persistDossier =
    options.persistDossier ??
    saveDossierVersion;

  const syncManualReview =
    options.syncManualReview ??
    syncManualReviewTasks;

  const runDossier =
    options.runDossier ??
    ((subjectId) =>
      orchestrateDossier(
        subjectId,
        {
          persistDossier,
          syncManualReview,
        },
      ));

  return async function handler(
    request,
    response,
  ) {
    if (
      request.method !== "POST"
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
      String(
        request.query?.subjectId ??
        "",
      ).trim();

    if (
      !UUID_RE.test(
        subjectId,
      )
    ) {
      return response
        .status(400)
        .json({
          ok: false,
          error:
            "Invalid subjectId",
        });
    }

    let dossier;

    try {
      dossier =
        await runDossier(
          subjectId,
        );
    } catch {
      response.setHeader(
        "Cache-Control",
        "no-store",
      );

      return response
        .status(500)
        .json({
          ok: false,
          error:
            "Failed to build dossier",
        });
    }

    response.setHeader(
      "Cache-Control",
      "no-store",
    );

    const subjectNotFound =
      Array.isArray(
        dossier?.errors,
      ) &&
      dossier.errors.some(
        (error) =>
          error?.code ===
          "subject_not_found",
      );

    if (subjectNotFound) {
      return response
        .status(404)
        .json({
          ok: false,
          error:
            "Subject not found",
          dossier,
        });
    }

    return response
      .status(200)
      .json({
        ok: true,
        dossier,
      });
  };
}

export default createDossierHandler();
