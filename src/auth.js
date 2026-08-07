import crypto from "node:crypto";

const COOKIE_NAME = "pm_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function portalPassword() {
  const password = process.env.PORTAL_PASSWORD?.trim();

  if (!password) {
    throw new Error("PORTAL_PASSWORD is not configured");
  }

  return password;
}

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest();
}

function sessionToken() {
  return crypto
    .createHash("sha256")
    .update(`person-monitor-session:${portalPassword()}`)
    .digest("hex");
}

function safeEqual(a, b) {
  return crypto.timingSafeEqual(hash(a), hash(b));
}

function readCookie(request, name) {
  const header = request.headers?.cookie ?? "";

  for (const part of header.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export function verifyPortalPassword(value) {
  return safeEqual(value ?? "", portalPassword());
}

export function isPortalAuthenticated(request) {
  const token = readCookie(request, COOKIE_NAME);
  return Boolean(token) && safeEqual(token, sessionToken());
}

export function setPortalSession(response) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`,
  );
}

export function clearPortalSession(response) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}
