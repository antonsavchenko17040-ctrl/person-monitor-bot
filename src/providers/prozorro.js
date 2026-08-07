import { searchGoogleQuery } from "./google-web.js";
import { buildNameQuery } from "./query.js";

export async function searchProzorro(subject) {
  const query = `${buildNameQuery(subject)} site:prozorro.gov.ua`;
  return searchGoogleQuery(query, {
    provider: "prozorro",
    source: "Prozorro",
    keepOperators: true,
  });
}
