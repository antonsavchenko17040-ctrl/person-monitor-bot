import { db } from "../src/db.js";

export default async function handler(request, response) {
  try {
    const sql = db();

    const rows = await sql`
      SELECT
        current_database() AS database,
        (SELECT count(*) FROM subjects) AS subjects,
        (SELECT count(*) FROM mentions) AS mentions
    `;

    return response.status(200).json({
      ok: true,
      database: rows[0].database,
      subjects: Number(rows[0].subjects),
      mentions: Number(rows[0].mentions),
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      error: "Database connection failed",
    });
  }
}
