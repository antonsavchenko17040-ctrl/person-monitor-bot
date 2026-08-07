import { isPortalAuthenticated } from "../src/auth.js";

export default async function handler(request, response) {
  try {
    return response.status(200).json({
      authenticated: isPortalAuthenticated(request),
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      authenticated: false,
    });
  }
}
