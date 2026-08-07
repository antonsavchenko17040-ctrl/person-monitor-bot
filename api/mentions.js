import { db } from "../src/db.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(request, response) {
  try {
    const subjectId = String(request.query?.subjectId ?? "").trim();

    if (!UUID_RE.test(subjectId)) {
      return response.status(400).json({
        ok: false,
        error: "Invalid subjectId",
      });
    }

    const sql = db();

    const mentions = await sql`
      SELECT
        id,
        provider,
        title,
        url,
        source,
        snippet,
        published_at,
        match_score,
        match_level,
        reasons,
        first_seen_at
      FROM mentions
      WHERE subject_id = ${subjectId}
      ORDER BY first_seen_at DESC
      LIMIT 100
    `;

    return response.status(200).json({
      ok: true,
      mentions,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      error: "Failed to load mentions",
    });
  }
}
