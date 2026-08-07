import { clearPortalSession } from "../src/auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  clearPortalSession(response);

  return response.status(200).json({
    ok: true,
  });
}
