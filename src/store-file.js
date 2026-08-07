import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { newId, stableFingerprint } from "./utils.js";

const EMPTY_DATA = { version: 1, users: {}, subjects: [], mentions: [] };
let writeQueue = Promise.resolve();

async function ensureFile(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(EMPTY_DATA, null, 2), "utf8");
  }
}

export async function readData() {
  const file = config().dataFile;
  await ensureFile(file);
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      version: 1,
      users: parsed.users ?? {},
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      mentions: Array.isArray(parsed.mentions) ? parsed.mentions : [],
    };
  } catch (error) {
    throw new Error(`Не вдалося прочитати ${file}: ${error.message}`);
  }
}

async function mutateData(mutator) {
  let result;
  writeQueue = writeQueue.then(async () => {
    const data = await readData();
    result = await mutator(data);
    const file = config().dataFile;
    const temporary = `${file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(temporary, file);
  });
  await writeQueue;
  return result;
}

export async function upsertUser({ chatId, username, firstName }) {
  return mutateData((data) => {
    const existing = data.users[chatId] ?? { created_at: new Date().toISOString() };
    data.users[chatId] = {
      ...existing,
      username: username ?? null,
      first_name: firstName ?? null,
      last_seen_at: new Date().toISOString(),
    };
  });
}

export async function createSubject(input) {
  return mutateData((data) => {
    const duplicate = data.subjects.find(
      (item) => item.chat_id === input.chatId
        && item.full_name.toLocaleLowerCase("uk-UA") === input.fullName.toLocaleLowerCase("uk-UA")
        && (item.organization ?? "") === (input.organization ?? ""),
    );
    if (duplicate) throw new Error("такий суб’єкт уже доданий");

    const subject = {
      id: newId(),
      chat_id: input.chatId,
      full_name: input.fullName,
      aliases: input.aliases ?? [],
      organization: input.organization ?? null,
      position: input.position ?? null,
      city: input.city ?? null,
      excluded_terms: input.excludedTerms ?? [],
      match_threshold: config().defaultMatchThreshold,
      enabled: true,
      created_at: new Date().toISOString(),
      last_checked_at: null,
    };
    data.subjects.push(subject);
    return subject;
  });
}

export async function listSubjects(chatId) {
  const data = await readData();
  return data.subjects
    .filter((item) => !chatId || item.chat_id === chatId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getSubject(id, chatId) {
  const data = await readData();
  return data.subjects.find((item) => item.id === id && (!chatId || item.chat_id === chatId)) ?? null;
}

export async function deleteSubject(id, chatId) {
  return mutateData((data) => {
    const before = data.subjects.length;
    data.subjects = data.subjects.filter((item) => !(item.id === id && item.chat_id === chatId));
    if (data.subjects.length === before) return false;
    data.mentions = data.mentions.filter((item) => item.subject_id !== id);
    return true;
  });
}

export async function addAlias(id, chatId, alias) {
  return mutateData((data) => {
    const subject = data.subjects.find((item) => item.id === id && item.chat_id === chatId);
    if (!subject) return null;
    if (!subject.aliases.some((value) => value.toLocaleLowerCase("uk-UA") === alias.toLocaleLowerCase("uk-UA"))) {
      subject.aliases.push(alias);
    }
    return subject;
  });
}

export async function addExcludedTerm(id, chatId, term) {
  return mutateData((data) => {
    const subject = data.subjects.find((item) => item.id === id && item.chat_id === chatId);
    if (!subject) return null;
    if (!subject.excluded_terms.some((value) => value.toLocaleLowerCase("uk-UA") === term.toLocaleLowerCase("uk-UA"))) {
      subject.excluded_terms.push(term);
    }
    return subject;
  });
}

export async function updateSubject(id, chatId, changes) {
  return mutateData((data) => {
    const subject = data.subjects.find((item) => item.id === id && item.chat_id === chatId);
    if (!subject) return null;

    const allowed = ["full_name", "organization", "position", "city", "aliases", "match_threshold"];
    for (const key of allowed) {
      if (Object.hasOwn(changes, key)) subject[key] = changes[key];
    }
    return subject;
  });
}

export async function markSubjectChecked(id, scanned = null) {
  return mutateData((data) => {
    const subject = data.subjects.find((item) => item.id === id);

    if (subject) {
      subject.last_checked_at = new Date().toISOString();

      if (Number.isInteger(scanned) && scanned >= 0) {
        subject.last_scanned_count = scanned;
      }
    }
  });
}

export async function saveMention(subject, result, assessment) {
  return mutateData((data) => {
    const fingerprint = stableFingerprint(result.title, result.source ?? "", result.url.replace(/[?#].*$/, ""));
    if (data.mentions.some((item) => item.subject_id === subject.id && item.fingerprint === fingerprint)) {
      return false;
    }
    data.mentions.push({
      id: newId(),
      subject_id: subject.id,
      fingerprint,
      provider: result.provider,
      title: result.title,
      url: result.url,
      source: result.source ?? null,
      snippet: result.snippet ?? null,
      published_at: result.publishedAt ?? null,
      match_score: assessment.score,
      match_level: assessment.level,
      reasons: assessment.reasons,
      first_seen_at: new Date().toISOString(),
    });
    return true;
  });
}

export async function listMentions(subjectId, limit = 10) {
  const data = await readData();
  return data.mentions
    .filter((item) => item.subject_id === subjectId)
    .sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at))
    .slice(0, limit);
}
