import { config } from "./config.js";
import { stableFingerprint } from "./utils.js";
import { searchGoogleWeb } from "./providers/google-web.js";
import { searchNazkDeclarations } from "./providers/nazk-declarations.js";
import { searchNazkCorruptRegister } from "./providers/nazk-corrupt-register.js";
import { searchOfficialSites } from "./providers/official-sites.js";
import { searchProzorro } from "./providers/prozorro.js";
import { searchCourtRegister } from "./providers/court-register.js";
import { searchCourtOpenData } from "./providers/court-open-data.js";
import { fetchText } from "./providers/http.js";
import { buildNameQuery } from "./providers/query.js";

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function xmlTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function cleanHtml(value) {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchGoogleNewsRss(subject) {
  const settings = config();
  const endpoint = new URL("https://news.google.com/rss/search");
  endpoint.searchParams.set("q", buildNameQuery(subject));
  endpoint.searchParams.set("hl", "uk");
  endpoint.searchParams.set("gl", "UA");
  endpoint.searchParams.set("ceid", "UA:uk");

  const xml = await fetchText(endpoint);
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  return blocks.slice(0, settings.maxResultsPerProvider).map((item) => ({
    provider: "google-news-rss",
    title: xmlTag(item, "title") || "Без заголовка",
    url: xmlTag(item, "link"),
    source: xmlTag(item, "source") || undefined,
    snippet: cleanHtml(xmlTag(item, "description")) || undefined,
    publishedAt: xmlTag(item, "pubDate")
      ? new Date(xmlTag(item, "pubDate")).toISOString()
      : undefined,
  })).filter((item) => /^https?:\/\//i.test(item.url));
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
