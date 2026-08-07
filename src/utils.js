import { createHash, randomUUID } from "node:crypto";

export function normalizeText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("uk-UA")
    .normalize("NFKD")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalizeText(value).split(" ").filter((token) => token.length >= 2);
}

export function stableFingerprint(...parts) {
  return createHash("sha256").update(parts.map(normalizeText).join("|")).digest("hex");
}

export function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function newId() {
  return randomUUID();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
