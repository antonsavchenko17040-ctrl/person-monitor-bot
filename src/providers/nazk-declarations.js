import { config } from "../config.js";
import { fetchJson } from "./http.js";

function firstValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function extractItems(parsed) {
  const candidates = [parsed?.data, parsed?.documents, parsed?.items, parsed?.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.data)) return candidate.data;
    if (Array.isArray(candidate?.items)) return candidate.items;
  }
  return [];
}

function declarationData(item) {
  return item?.data?.step_1?.data ?? {};
}

function declarationName(item) {
  const details = declarationData(item);

  const full =
    firstValue(item, ["full_name", "declarant_name", "name"]) ??
    firstValue(details, ["full_name", "declarant_name", "name"]);

  if (full) return String(full);

  const last =
    firstValue(item, ["lastname", "last_name"]) ??
    firstValue(details, ["lastname", "last_name"]);

  const first =
    firstValue(item, ["firstname", "first_name"]) ??
    firstValue(details, ["firstname", "first_name"]);

  const middle =
    firstValue(item, ["middlename", "middle_name"]) ??
    firstValue(details, ["middlename", "middle_name"]);

  return [last, first, middle].filter(Boolean).join(" ");
}

function normalizeName(value) {
  return String(value ?? "")
    .toLocaleLowerCase("uk-UA")
    .replace(/\s+/g, " ")
    .trim();
}

function safeIso(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function searchNazkDeclarations(subject) {
  const settings = config();
  const endpoint = new URL("https://public-api.nazk.gov.ua/v2/documents/list");
  endpoint.searchParams.set("query", subject.full_name);

  const parsed = await fetchJson(endpoint, { timeoutMs: 30_000 });
  if (parsed?.error) throw new Error(`НАЗК API: ${parsed.error}`);

  const expectedName = normalizeName(subject.full_name);

  return extractItems(parsed)
    .map((item) => ({ item, name: declarationName(item) }))
    .filter(({ name }) => normalizeName(name) === expectedName)
    .slice(0, Math.max(settings.maxResultsPerProvider, 100))
    .map(({ item, name }) => {
      const details = declarationData(item);
      const declaration = item?.data?.step_0?.data ?? {};

      const id = String(firstValue(item, ["id", "document_id", "uuid"]) ?? "");

      const year =
        firstValue(declaration, ["declaration_year", "year"]) ??
        firstValue(item, ["declaration_year", "year"]);

      const type =
        firstValue(declaration, ["declaration_type", "document_type_name", "document_type"]) ??
        firstValue(item, ["document_type_name", "document_type"]);
      const workplace =
        firstValue(item, ["work_place", "workPlace", "place_of_work"]) ??
        firstValue(details, ["work_place", "workPlace", "place_of_work"]);

      const position =
        firstValue(details, [
          "position",
          "work_post",
          "workPost",
          "responsiblePositionWhatExact",
          "responsiblePosition",
        ]) ??
        firstValue(item, ["position", "work_post", "workPost"]);
      const titleParts = [`Декларація НАЗК: ${name}`];
      if (year) titleParts.push(String(year));
      const snippetParts = [
        workplace,
        position,
        type ? `\u0422\u0438\u043f: ${type}` : null,
      ].filter(Boolean);

      const uniqueSnippetParts = snippetParts.filter(
        (value, index, items) =>
          items.findIndex(
            (candidate) => normalizeName(candidate) === normalizeName(value),
          ) === index,
      );

      const snippet = uniqueSnippetParts.join(" \u00b7 ");

      return {
        provider: "nazk-declarations",
        title: titleParts.join(" — "),
        url: id
          ? `https://public-api.nazk.gov.ua/v2/documents/${encodeURIComponent(id)}`
          : `https://public.nazk.gov.ua/`,
        source: "Єдиний державний реєстр декларацій НАЗК",
        snippet: snippet || `Декларант: ${name}`,
        publishedAt: safeIso(firstValue(item, ["date", "created_at", "published_at"])),
      };
    });
}
