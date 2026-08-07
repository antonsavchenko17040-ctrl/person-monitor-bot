import { assessMatch } from "./scoring.js";
import { searchAllProviders } from "./search.js";
import { markSubjectChecked, saveMention } from "./store.js";

export async function monitorSubject(subject) {
  const { results, errors } = await searchAllProviders(subject);
  const mentions = [];
  const newMentions = [];

  for (const result of results) {
    const assessment = assessMatch(subject, result);
    if (assessment.level === "rejected") continue;

    const mention = { ...result, ...assessment };
    mentions.push(mention);

    if (await saveMention(subject, result, assessment)) {
      newMentions.push(mention);
    }
  }

  await markSubjectChecked(subject.id, results.length);
  return { mentions, newMentions, scanned: results.length, errors };
}
