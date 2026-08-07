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

    const subjectRows = await sql`
      SELECT
        id,
        full_name,
        organization,
        position,
        city,
        match_threshold,
        enabled,
        last_checked_at,
        last_scanned_count
      FROM subjects
      WHERE id = ${subjectId}
      LIMIT 1
    `;

    if (!subjectRows.length) {
      return response.status(404).json({
        ok: false,
        error: "Subject not found",
      });
    }

    const [summaryRows, providers] = await Promise.all([
      sql`
        SELECT
          count(*)::int AS mentions,
          (count(*) FILTER (
            WHERE match_level = 'confirmed'
          ))::int AS confirmed,
          (count(*) FILTER (
            WHERE match_level <> 'confirmed'
          ))::int AS probable,
          max(first_seen_at) AS last_found_at
        FROM mentions
        WHERE subject_id = ${subjectId}
      `,
      sql`
        SELECT
          provider,
          count(*)::int AS mentions,
          (count(*) FILTER (
            WHERE match_level = 'confirmed'
          ))::int AS confirmed
        FROM mentions
        WHERE subject_id = ${subjectId}
        GROUP BY provider
        ORDER BY mentions DESC, provider ASC
      `,
    ]);

    return response.status(200).json({
      ok: true,
      subject: subjectRows[0],
      summary: summaryRows[0],
      providers,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      error: "Failed to load subject statistics",
    });
  }
}
