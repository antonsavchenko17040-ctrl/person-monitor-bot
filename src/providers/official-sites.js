import { searchGoogleQuery } from "./google-web.js";
import { buildNameQuery } from "./query.js";

const OFFICIAL_DOMAINS = [
  "gov.ua",
  "president.gov.ua",
  "kmu.gov.ua",
  "rada.gov.ua",
  "nazk.gov.ua",
];

export async function searchOfficialSites(subject) {
  const sites = OFFICIAL_DOMAINS.map((domain) => `site:${domain}`).join(" OR ");
  const query = `${buildNameQuery(subject)} (${sites})`;
  return searchGoogleQuery(query, {
    provider: "official-sites",
    source: "Офіційні сайти органів влади",
    keepOperators: true,
  });
}
