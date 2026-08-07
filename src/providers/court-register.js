import { searchGoogleQuery } from "./google-web.js";
import { buildNameQuery } from "./query.js";

export async function searchCourtRegister(subject) {
  const query = `${buildNameQuery(subject)} (site:reyestr.court.gov.ua OR site:court.gov.ua)`;
  return searchGoogleQuery(query, {
    provider: "court-register",
    source: "Судовий реєстр — вебпошук",
    keepOperators: true,
  });
}
