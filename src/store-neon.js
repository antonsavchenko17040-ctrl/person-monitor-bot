import { db } from "./db.js";
import { config } from "./config.js";
import { newId, stableFingerprint } from "./utils.js";

function iso(value) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeSubject(row) {
  if (!row) return null;

  return {
    ...row,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    excluded_terms: Array.isArray(row.excluded_terms) ? row.excluded_terms : [],
    created_at: iso(row.created_at),
    last_checked_at: iso(row.last_checked_at),
    last_scanned_count:
      row.last_scanned_count == null ? undefined : Number(row.last_scanned_count),
    match_threshold: Number(row.match_threshold),
  };
}

function normalizeMention(row) {
  if (!row) return null;

  return {
    ...row,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    match_score: Number(row.match_score),
    first_seen_at: iso(row.first_seen_at),
  };
}

export async function readData() {
  const sql = db();

  const [users, subjects, mentions] = await Promise.all([
    sql`SELECT * FROM users ORDER BY created_at ASC`,
    sql`SELECT * FROM subjects ORDER BY created_at DESC`,
    sql`SELECT * FROM mentions ORDER BY first_seen_at DESC`,
  ]);

  const userMap = {};

  for (const user of users) {
    userMap[user.chat_id] = {
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      created_at: iso(user.created_at),
      last_seen_at: iso(user.last_seen_at),
    };
  }

  return {
    version: 1,
    users: userMap,
    subjects: subjects.map(normalizeSubject),
    mentions: mentions.map(normalizeMention),
  };
}

export async function upsertUser({ chatId, username, firstName }) {
  const sql = db();

  await sql`
    INSERT INTO users (
      chat_id,
      username,
      first_name,
      created_at,
      last_seen_at
    )
    VALUES (
      ${String(chatId)},
      ${username ?? null},
      ${firstName ?? null},
      now(),
      now()
    )
    ON CONFLICT (chat_id)
    DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_seen_at = now()
  `;
}

export async function createSubject(input) {
  const sql = db();
  const chatId = input.chatId == null ? null : String(input.chatId);

  const duplicates = chatId
    ? await sql`
        SELECT id
        FROM subjects
        WHERE chat_id = ${chatId}
          AND lower(full_name) = lower(${input.fullName})
          AND coalesce(organization, '') = ${input.organization ?? ""}
        LIMIT 1
      `
    : await sql`
        SELECT id
        FROM subjects
        WHERE chat_id IS NULL
          AND lower(full_name) = lower(${input.fullName})
          AND coalesce(organization, '') = ${input.organization ?? ""}
        LIMIT 1
      `;

  if (duplicates.length > 0) {
    throw new Error("\u0442\u0430\u043a\u0438\u0439 \u0441\u0443\u0431\u2019\u0454\u043a\u0442 \u0443\u0436\u0435 \u0434\u043e\u0434\u0430\u043d\u0438\u0439");
  }

  const id = newId();

  const rows = await sql`
    INSERT INTO subjects (
      id,
      chat_id,
      full_name,
      aliases,
      organization,
      position,
      city,
      excluded_terms,
      match_threshold,
      enabled,
      created_at,
      last_checked_at
    )
    VALUES (
      ${id},
      ${chatId},
      ${input.fullName},
      ${JSON.stringify(input.aliases ?? [])}::jsonb,
      ${input.organization ?? null},
      ${input.position ?? null},
      ${input.city ?? null},
      ${JSON.stringify(input.excludedTerms ?? [])}::jsonb,
      ${config().defaultMatchThreshold},
      true,
      now(),
      NULL
    )
    RETURNING *
  `;

  return normalizeSubject(rows[0]);
}

export async function listSubjects(chatId) {
  const sql = db();

  const rows = chatId
    ? await sql`
        SELECT *
        FROM subjects
        WHERE chat_id = ${String(chatId)}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT *
        FROM subjects
        ORDER BY created_at DESC
      `;

  return rows.map(normalizeSubject);
}

export async function getSubject(id, chatId) {
  const sql = db();

  const rows = chatId
    ? await sql`
        SELECT *
        FROM subjects
        WHERE id = ${id}
          AND chat_id = ${String(chatId)}
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM subjects
        WHERE id = ${id}
        LIMIT 1
      `;

  return normalizeSubject(rows[0] ?? null);
}

export async function deleteSubject(id, chatId) {
  const sql = db();

  const rows = chatId
    ? await sql`
        DELETE FROM subjects
        WHERE id = ${id}
          AND chat_id = ${String(chatId)}
        RETURNING id
      `
    : await sql`
        DELETE FROM subjects
        WHERE id = ${id}
        RETURNING id
      `;

  return rows.length > 0;
}

export async function addAlias(id, chatId, alias) {
  const subject = await getSubject(id, chatId);
  if (!subject) return null;

  const exists = subject.aliases.some(
    (value) =>
      value.toLocaleLowerCase("uk-UA") === alias.toLocaleLowerCase("uk-UA"),
  );

  if (!exists) {
    subject.aliases.push(alias);
  }

  const sql = db();

  const rows = await sql`
    UPDATE subjects
    SET aliases = ${JSON.stringify(subject.aliases)}::jsonb
    WHERE id = ${id}
    RETURNING *
  `;

  return normalizeSubject(rows[0] ?? null);
}

export async function addExcludedTerm(id, chatId, term) {
  const subject = await getSubject(id, chatId);
  if (!subject) return null;

  const exists = subject.excluded_terms.some(
    (value) =>
      value.toLocaleLowerCase("uk-UA") === term.toLocaleLowerCase("uk-UA"),
  );

  if (!exists) {
    subject.excluded_terms.push(term);
  }

  const sql = db();

  const rows = await sql`
    UPDATE subjects
    SET excluded_terms = ${JSON.stringify(subject.excluded_terms)}::jsonb
    WHERE id = ${id}
    RETURNING *
  `;

  return normalizeSubject(rows[0] ?? null);
}

export async function updateSubject(id, chatId, changes) {
  const subject = await getSubject(id, chatId);
  if (!subject) return null;

  const allowed = [
    "full_name",
    "organization",
    "position",
    "city",
    "aliases",
    "match_threshold",
  ];

  for (const key of allowed) {
    if (Object.hasOwn(changes, key)) {
      subject[key] = changes[key];
    }
  }

  const sql = db();

  const rows = await sql`
    UPDATE subjects
    SET
      full_name = ${subject.full_name},
      organization = ${subject.organization ?? null},
      position = ${subject.position ?? null},
      city = ${subject.city ?? null},
      aliases = ${JSON.stringify(subject.aliases ?? [])}::jsonb,
      match_threshold = ${subject.match_threshold}
    WHERE id = ${id}
    RETURNING *
  `;

  return normalizeSubject(rows[0] ?? null);
}

export async function markSubjectChecked(id, scanned = null) {
  const sql = db();

  if (Number.isInteger(scanned) && scanned >= 0) {
    await sql`
      UPDATE subjects
      SET
        last_checked_at = now(),
        last_scanned_count = ${scanned}
      WHERE id = ${id}
    `;
    return;
  }

  await sql`
    UPDATE subjects
    SET last_checked_at = now()
    WHERE id = ${id}
  `;
}

export async function saveMention(subject, result, assessment) {
  const sql = db();

  const fingerprint = stableFingerprint(
    result.title,
    result.source ?? "",
    result.url.replace(/[?#].*$/, ""),
  );

  const rows = await sql`
    INSERT INTO mentions (
      id,
      subject_id,
      fingerprint,
      provider,
      title,
      url,
      source,
      snippet,
      published_at,
      match_score,
      match_level,
      reasons,
      first_seen_at
    )
    VALUES (
      ${newId()},
      ${subject.id},
      ${fingerprint},
      ${result.provider},
      ${result.title},
      ${result.url},
      ${result.source ?? null},
      ${result.snippet ?? null},
      ${result.publishedAt ?? null},
      ${assessment.score},
      ${assessment.level},
      ${JSON.stringify(assessment.reasons ?? [])}::jsonb,
      now()
    )
    ON CONFLICT (subject_id, fingerprint)
    DO NOTHING
    RETURNING id
  `;

  return rows.length > 0;
}

export async function listMentions(subjectId, limit = 10) {
  const sql = db();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 10000));

  const rows = await sql`
    SELECT *
    FROM mentions
    WHERE subject_id = ${subjectId}
    ORDER BY first_seen_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map(normalizeMention);
}
