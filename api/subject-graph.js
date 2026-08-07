import {
  loadSubjectGraph,
} from "../src/subject-graph.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstValue(value) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function handler(
  request,
  response,
) {
  if (
    request.method &&
    request.method !== "GET"
  ) {
    return response
      .status(405)
      .json({
        ok: false,
        error: "Method not allowed",
      });
  }

  try {
    const subjectId =
      String(
        firstValue(
          request.query?.subjectId,
        ) ?? "",
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
          error: "Invalid subjectId",
        });
    }

    const rawYear =
      firstValue(
        request.query?.year,
      );

    let year = null;

    if (
      rawYear !== undefined &&
      rawYear !== null &&
      String(rawYear).trim() !== ""
    ) {
      year = Number(rawYear);

      if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2100
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error: "Invalid year",
          });
      }
    }

    const graph =
      await loadSubjectGraph(
        subjectId,
        { year },
      );

    if (!graph) {
      return response
        .status(404)
        .json({
          ok: false,
          error: "Subject not found",
        });
    }

    response.setHeader(
      "Cache-Control",
      "no-store",
    );

    return response
      .status(200)
      .json({
        ok: true,
        ...graph,
      });
  } catch (error) {
    console.error(
      "Subject graph loading failed:",
      error,
    );

    return response
      .status(500)
      .json({
        ok: false,
        error:
          "Failed to load subject graph",
      });
  }
}
