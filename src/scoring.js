import { clamp, normalizeText, tokenize } from "./utils.js";

function tokenStem(token) {
  if (token.length <= 5) return token;
  return token.slice(0, Math.max(5, token.length - 2));
}

function tokenMatches(token, words) {
  const stem = tokenStem(token);
  return words.some((word) => word === token || word.startsWith(stem));
}

function countNameTokenMatches(name, haystack) {
  const words = normalizeText(haystack).split(" ").filter(Boolean);
  return tokenize(name).filter((token) => tokenMatches(token, words)).length;
}

function countContextMatches(context, haystack) {
  if (!context) return 0;
  const normalizedHaystack = normalizeText(haystack);
  return tokenize(context)
    .filter((token) => token.length >= 4)
    .filter((token) => normalizedHaystack.includes(tokenStem(token)))
    .length;
}

export function assessMatch(subject, result) {
  const haystack = `${result.title ?? ""} ${result.snippet ?? ""} ${result.source ?? ""}`;
  const normalizedHaystack = normalizeText(haystack);
  const reasons = [];
  let score = 0;

  const fullName = normalizeText(subject.full_name);
  const nameTokens = tokenize(subject.full_name);
  const matchedNameTokens = countNameTokenMatches(subject.full_name, haystack);

  if (fullName && normalizedHaystack.includes(fullName)) {
    score += 68;
    reasons.push("точний збіг повного ПІБ");
  } else if (nameTokens.length >= 3 && matchedNameTokens >= 3) {
    score += 48;
    reasons.push("збіг усіх основних частин ПІБ з урахуванням відмінків");
  } else if (matchedNameTokens >= 2) {
    // Двох частин ПІБ недостатньо для самостійного прийняття результату.
    score += 24;
    reasons.push("частковий збіг ПІБ");
  } else if (matchedNameTokens === 1) {
    score += 5;
    reasons.push("збіг лише однієї частини ПІБ");
  }

  for (const alias of subject.aliases ?? []) {
    const normalizedAlias = normalizeText(alias);
    if (normalizedAlias && normalizedHaystack.includes(normalizedAlias)) {
      score += tokenize(alias).length >= 3 ? 55 : 28;
      reasons.push(`збіг альтернативного написання: ${alias}`);
      break;
    }
  }

  const organizationMatches = countContextMatches(subject.organization, haystack);
  if (organizationMatches >= 2) {
    score += 22;
    reasons.push("збіг організації");
  } else if (organizationMatches === 1) {
    score += 10;
    reasons.push("частковий збіг організації");
  }

  const positionMatches = countContextMatches(subject.position, haystack);
  if (positionMatches >= 2) {
    score += 12;
    reasons.push("збіг посади");
  } else if (positionMatches === 1) {
    score += 5;
    reasons.push("частковий збіг посади");
  }

  if (countContextMatches(subject.city, haystack) >= 1) {
    score += 8;
    reasons.push("збіг міста або регіону");
  }

  for (const excluded of subject.excluded_terms ?? []) {
    const normalizedExcluded = normalizeText(excluded);
    if (normalizedExcluded && normalizedHaystack.includes(normalizedExcluded)) {
      score -= 45;
      reasons.push(`виявлено виключення: ${excluded}`);
    }
  }

  score = clamp(score);
  const threshold = Number(subject.match_threshold ?? 75);
  const level = score >= Math.max(85, threshold + 10)
    ? "confirmed"
    : score >= threshold
      ? "probable"
      : "rejected";

  return { score, level, reasons };
}
