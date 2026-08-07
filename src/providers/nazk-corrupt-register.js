import { searchGoogleQuery } from "./google-web.js";
import { buildNameQuery } from "./query.js";

export async function searchNazkCorruptRegister(subject) {
  const query = `${buildNameQuery(subject)} site:corruptinfo.nazk.gov.ua`;
  return searchGoogleQuery(query, {
    provider: "nazk-corrupt-register",
    source: "Реєстр корупціонерів НАЗК",
    keepOperators: true,
  });
}
