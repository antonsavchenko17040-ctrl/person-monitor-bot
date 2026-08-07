import {
  setPortalSession,
  verifyPortalPassword,
} from "../src/auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const password = request.body?.password ?? "";

    if (!verifyPortalPassword(password)) {
      return response.status(401).json({
        ok: false,
        error: "Invalid password",
      });
    }

    setPortalSession(response);

    return response.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      error: "Authentication failed",
    });
  }
}
