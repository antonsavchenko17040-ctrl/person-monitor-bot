import {
  createChatApiHandler,
} from "../src/chat-api.js";
import { db } from "../src/db.js";
import {
  createResearchApiHandler,
} from "../src/research-api.js";

const chatHandler =
  createChatApiHandler();

const researchHandler =
  createResearchApiHandler();

async function healthHandler(
  request,
  response,
) {
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

export default async function handler(
  request,
  response,
) {
  if (
    request.query?.route ===
    "health"
  ) {
    return healthHandler(
      request,
      response,
    );
  }

  if (
    String(request.query?.route ?? "")
      .startsWith("research")
  ) {
    return researchHandler(
      request,
      response,
    );
  }

  return chatHandler(
    request,
    response,
  );
}
