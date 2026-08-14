import {
  isResearchValidationError,
  parseJsonBody,
} from "./research-contract.js";
import {
  getResearchStatus,
  refineResearch,
  resolveResearchCandidate,
  startResearch,
} from "./research-orchestrator.js";

function send(response, status, payload) {
  return response.status(status).json(payload);
}

function safeError(error) {
  if (error?.message === "FULL_NAME_REQUIRED") {
    return "Вкажіть ПІБ особи.";
  }

  if (error?.message === "INVALID_BIRTH_DATE") {
    return "Дата народження має бути у форматі РРРР-ММ-ДД.";
  }

  if (isResearchValidationError(error)) {
    return "Некоректні параметри дослідження.";
  }

  if (error?.message === "CANDIDATE_NOT_FOUND") {
    return "Кандидат не належить цьому дослідженню.";
  }

  return "Не вдалося виконати операцію дослідження.";
}

export function createResearchApiHandler(options = {}) {
  return async function researchApiHandler(request, response) {
    response.setHeader("Cache-Control", "no-store");

    const route = String(request.query?.route ?? "research");

    try {
      if (route === "research-status") {
        if (request.method !== "GET") {
          return send(response, 405, { ok: false, error: "Method not allowed" });
        }

        const research = await (
          options.getStatus ?? getResearchStatus
        )(request.query?.researchRequestId, options.orchestratorOptions);

        if (!research) {
          return send(response, 404, { ok: false, error: "Дослідження не знайдено." });
        }

        return send(response, 200, { ok: true, research });
      }

      if (request.method !== "POST") {
        return send(response, 405, { ok: false, error: "Method not allowed" });
      }

      const body = parseJsonBody(request);
      let research;

      if (route === "research-refine") {
        research = await (
          options.refine ?? refineResearch
        )(body, options.orchestratorOptions);
      } else if (route === "research-resolve") {
        research = await (
          options.resolve ?? resolveResearchCandidate
        )(body, options.orchestratorOptions);
      } else if (route === "research") {
        research = await (
          options.start ?? startResearch
        )(body, options.orchestratorOptions);
      } else {
        return send(response, 404, { ok: false, error: "Endpoint not found" });
      }

      if (!research) {
        return send(response, 404, { ok: false, error: "Дослідження не знайдено." });
      }

      return send(response, route === "research" ? 201 : 200, {
        ok: true,
        researchRequestId: research.id,
        research,
      });
    } catch (error) {
      console.error("Research API failed", {
        route,
        message: error?.message,
      });

      const status = error?.statusCode ?? (
        isResearchValidationError(error) ? 400 : 500
      );

      return send(response, status, {
        ok: false,
        error: safeError(error),
      });
    }
  };
}
