import { config } from "./config.js";
import { stableFingerprint } from "./utils.js";
import { searchGoogleWeb } from "./providers/google-web.js";
import { searchGoogleNewsRss as searchCorruptionGoogleNewsRss } from "./providers/google-news.js";
import { searchNazkDeclarations } from "./providers/nazk-declarations.js";
import { searchNazkCorruptRegister } from "./providers/nazk-corrupt-register.js";
import { searchOfficialSites } from "./providers/official-sites.js";
import { searchProzorro } from "./providers/prozorro.js";
import { searchCourtRegister } from "./providers/court-register.js";
import { searchCourtOpenData } from "./providers/court-open-data.js";

export async function searchGoogleNewsRss(
  subject,
) {
  return searchCorruptionGoogleNewsRss(
    subject,
  );
}

export async function searchAllProviders(subject) {
  const providers = [
    searchGoogleNewsRss,
    searchGoogleWeb,
    searchNazkDeclarations,
    searchNazkCorruptRegister,
    searchOfficialSites,
    searchProzorro,
    searchCourtOpenData,
    searchCourtRegister,
  ];

  const settled = await Promise.allSettled(providers.map((provider) => provider(subject)));
  const errors = [];
  const deduped = new Map();

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      errors.push(`${providers[index].name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      return;
    }

    for (const item of result.value) {
      const key = stableFingerprint(item.title, item.source ?? "", item.url.replace(/[?#].*$/, ""));
      if (!deduped.has(key)) deduped.set(key, item);
    }
  });

  return { results: [...deduped.values()], errors };
}
