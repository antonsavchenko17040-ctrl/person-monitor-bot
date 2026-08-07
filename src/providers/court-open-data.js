import fs from "node:fs/promises";
import { config } from "../config.js";
import { normalizeText } from "../utils.js";

function text(value) {
  return String(value ?? "").trim();
}

function subjectEntry(index, subject) {
  const subjects = index?.subjects;
  if (subjects && !Array.isArray(subjects) && subjects[subject.id]) return subjects[subject.id];

  const entries = Array.isArray(subjects)
    ? subjects
    : Array.isArray(index?.people)
      ? index.people
      : [];

  const target = normalizeText(subject.full_name);
  return entries.find((item) =>
    item?.subject_id === subject.id || normalizeText(item?.full_name) === target,
  );
}

export async function searchCourtOpenData(subject) {
  let index;
  try {
    index = JSON.parse(await fs.readFile(config().courtIndexFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw new Error(`Не вдалося прочитати судовий open-data index: ${error.message}`);
  }

  const entry = subjectEntry(index, subject);
  const matches = Array.isArray(entry?.matches) ? entry.matches : [];

  return matches.map((match) => {
    const caseNumber = text(match.case_number) || "без номера";
    const courtName = text(match.court_name) || "Суд";
    const snippet = [
      text(match.participants) ? `Учасники: ${text(match.participants)}` : null,
      text(match.stage_name) ? `Стадія: ${text(match.stage_name)}` : null,
      text(match.cause_result) ? `Результат: ${text(match.cause_result)}` : null,
      text(match.type) ? `Тип: ${text(match.type)}` : null,
      text(match.description) ? `Опис: ${text(match.description)}` : null,
    ].filter(Boolean).join(" · ");

    return {
      provider: "court-open-data",
      title: `Судова справа ${caseNumber} — ${courtName}`,
      url: "https://court.gov.ua/fair/",
      source: "Судова влада України — стан розгляду справ",
      snippet,
      publishedAt: match.stage_date || match.registration_date || undefined,
    };
  });
}
