import {
  db,
} from "./db.js";

import {
  MANUAL_REVIEW_MANIFEST_VERSION,
  MANUAL_REVIEW_SOURCE_PATH_RELATED_PEOPLE,
  MANUAL_REVIEW_SOURCE_PATH_RELATIONS,
  MANUAL_REVIEW_SOURCE_PATHS,
  MANUAL_REVIEW_TYPE_IDENTITY_RESOLUTION,
  MANUAL_REVIEW_TASK_STATUSES,
} from "./manual-review-contract.js";


export const MANUAL_REVIEW_STORE_VERSION =
  "manual-review-store-v1";


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RELATED_PERSON_REF_RE =
  /^related-person-ref-v1:[0-9a-f]{64}$/;

const SOURCE_PATH_SET =
  new Set(
    MANUAL_REVIEW_SOURCE_PATHS,
  );


const TASK_STATUS_SET =
  new Set(
    MANUAL_REVIEW_TASK_STATUSES,
  );

export const MANUAL_REVIEW_LIST_DEFAULT_LIMIT =
  100;

export const MANUAL_REVIEW_LIST_MAX_LIMIT =
  200;


function requiredText(
  value,
  field,
) {
  const text =
    String(
      value ?? "",
    ).trim();

  if (!text) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return text;
}


function requiredUuid(
  value,
  field,
) {
  const text =
    requiredText(
      value,
      field,
    );

  if (!UUID_RE.test(text)) {
    throw new TypeError(
      `${field} must be a UUID`,
    );
  }

  return text.toLowerCase();
}


function requiredPlainObject(
  value,
  field,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      `${field} must be an object`,
    );
  }

  const prototype =
    Object.getPrototypeOf(
      value,
    );

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw new TypeError(
      `${field} must be a plain object`,
    );
  }

  return value;
}


function hasExactKeys(
  value,
  expected,
) {
  const actual =
    Object.keys(
      value,
    ).sort();

  const wanted =
    [...expected].sort();

  return (
    actual.length === wanted.length &&
    actual.every(
      (key, index) =>
        key === wanted[index],
    )
  );
}


function normalizeReviewItem(
  value,
  index,
) {
  const field =
    `manualReview.items[${index}]`;

  const item =
    requiredPlainObject(
      value,
      field,
    );

  if (
    !hasExactKeys(
      item,
      [
        "source_path",
        "item_ref",
        "review_type",
      ],
    )
  ) {
    throw new TypeError(
      `${field} must be reference-only`,
    );
  }

  const sourcePath =
    requiredText(
      item.source_path,
      `${field}.source_path`,
    );

  if (
    !SOURCE_PATH_SET.has(
      sourcePath,
    )
  ) {
    throw new TypeError(
      `${field}.source_path is not supported`,
    );
  }

  const reviewType =
    requiredText(
      item.review_type,
      `${field}.review_type`,
    );

  if (
    reviewType !==
    MANUAL_REVIEW_TYPE_IDENTITY_RESOLUTION
  ) {
    throw new TypeError(
      `${field}.review_type is not supported`,
    );
  }

  const rawRef =
    requiredText(
      item.item_ref,
      `${field}.item_ref`,
    );

  let itemRef =
    rawRef;

  if (
    sourcePath ===
    MANUAL_REVIEW_SOURCE_PATH_RELATED_PEOPLE
  ) {
    if (
      !RELATED_PERSON_REF_RE.test(
        rawRef,
      )
    ) {
      throw new TypeError(
        `${field}.item_ref must be a related-person reference`,
      );
    }
  } else if (
    sourcePath ===
    MANUAL_REVIEW_SOURCE_PATH_RELATIONS
  ) {
    itemRef =
      requiredUuid(
        rawRef,
        `${field}.item_ref`,
      );
  }

  return {
    source_path:
      sourcePath,

    item_ref:
      itemRef,

    review_type:
      reviewType,
  };
}


function normalizeManifest(
  value,
) {
  const manifest =
    requiredPlainObject(
      value,
      "manualReview",
    );

  if (
    !hasExactKeys(
      manifest,
      [
        "version",
        "items",
      ],
    )
  ) {
    throw new TypeError(
      "manualReview must be reference-only",
    );
  }

  const version =
    requiredText(
      manifest.version,
      "manualReview.version",
    );

  if (
    version !==
    MANUAL_REVIEW_MANIFEST_VERSION
  ) {
    throw new TypeError(
      "manualReview.version is not supported",
    );
  }

  if (
    !Array.isArray(
      manifest.items,
    )
  ) {
    throw new TypeError(
      "manualReview.items must be an array",
    );
  }

  const items = [];
  const seen =
    new Set();

  for (
    let index = 0;
    index < manifest.items.length;
    index += 1
  ) {
    const item =
      normalizeReviewItem(
        manifest.items[index],
        index,
      );

    const key =
      JSON.stringify([
        item.source_path,
        item.item_ref,
        item.review_type,
      ]);

    if (
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    items.push(
      item,
    );
  }

  return {
    version,
    items,
  };
}


function integerValue(
  value,
  field,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      number,
    ) ||
    number < 0
  ) {
    throw new Error(
      `${field} must be a non-negative integer`,
    );
  }

  return number;
}


export async function syncManualReviewTasks(
  {
    subjectId,
    dossierVersionId,
    manualReview,
  } = {},
  options = {},
) {
  const normalizedSubjectId =
    requiredUuid(
      subjectId,
      "subjectId",
    );

  const normalizedDossierVersionId =
    requiredUuid(
      dossierVersionId,
      "dossierVersionId",
    );

  const manifest =
    normalizeManifest(
      manualReview,
    );

  const itemsJson =
    JSON.stringify(
      manifest.items,
    );

  const sql =
    options.sql ??
    db();

  const rows =
    await sql`
      WITH version_row AS (
        SELECT
          subject_id
        FROM dossier_versions
        WHERE id =
          ${normalizedDossierVersionId}
      ),

      version_check AS (
        SELECT
          EXISTS (
            SELECT 1
            FROM version_row
          ) AS dossier_version_exists,

          EXISTS (
            SELECT 1
            FROM version_row
            WHERE subject_id =
              ${normalizedSubjectId}
          ) AS subject_matches
      ),

      input_items AS (
        SELECT
          source_path,
          item_ref,
          review_type
        FROM jsonb_to_recordset(
          ${itemsJson}::jsonb
        ) AS item(
          source_path text,
          item_ref text,
          review_type text
        )
      ),

      synced_tasks AS (
        INSERT INTO manual_review_tasks (
          subject_id,
          source_path,
          item_ref,
          review_type
        )
        SELECT
          ${normalizedSubjectId},
          item.source_path,
          item.item_ref,
          item.review_type
        FROM input_items AS item
        WHERE (
          SELECT
            subject_matches
          FROM version_check
        )
        ON CONFLICT (
          subject_id,
          source_path,
          item_ref,
          review_type
        )
        DO UPDATE SET
          task_status =
            manual_review_tasks.task_status
        RETURNING
          id,
          source_path,
          item_ref,
          review_type,
          task_status
      ),

      inserted_occurrences AS (
        INSERT INTO
          manual_review_task_occurrences (
            task_id,
            dossier_version_id,
            manifest_version
          )
        SELECT
          task.id,
          ${normalizedDossierVersionId},
          ${manifest.version}
        FROM synced_tasks AS task
        ON CONFLICT (
          task_id,
          dossier_version_id
        )
        DO NOTHING
        RETURNING
          id
      )

      SELECT
        (
          SELECT
            dossier_version_exists
          FROM version_check
        ) AS dossier_version_exists,

        (
          SELECT
            subject_matches
          FROM version_check
        ) AS subject_matches,

        (
          SELECT
            count(*)::int
          FROM input_items
        ) AS item_count,

        (
          SELECT
            count(*)::int
          FROM synced_tasks
        ) AS task_count,

        (
          SELECT
            count(*)::int
          FROM inserted_occurrences
        ) AS occurrences_created
    `;

  const row =
    rows?.[0] ??
    null;

  if (!row) {
    throw new Error(
      "Manual review sync returned no summary",
    );
  }

  if (
    row.dossier_version_exists !== true
  ) {
    throw new Error(
      "Dossier version not found",
    );
  }

  if (
    row.subject_matches !== true
  ) {
    throw new TypeError(
      "dossier version subject does not match subjectId",
    );
  }

  const itemCount =
    integerValue(
      row.item_count,
      "item_count",
    );

  const taskCount =
    integerValue(
      row.task_count,
      "task_count",
    );

  const occurrencesCreated =
    integerValue(
      row.occurrences_created,
      "occurrences_created",
    );

  if (
    taskCount !== itemCount
  ) {
    throw new Error(
      "Failed to sync all manual review tasks",
    );
  }

  return {
    subject_id:
      normalizedSubjectId,

    dossier_version_id:
      normalizedDossierVersionId,

    manifest_version:
      manifest.version,

    item_count:
      itemCount,

    task_count:
      taskCount,

    occurrences_created:
      occurrencesCreated,
  };
}

function normalizeTaskStatus(
  value,
  {
    allowAll = false,
  } = {},
) {
  const text =
    requiredText(
      value,
      "taskStatus",
    );

  if (
    allowAll &&
    text === "all"
  ) {
    return null;
  }

  if (
    !TASK_STATUS_SET.has(
      text,
    )
  ) {
    throw new TypeError(
      "taskStatus must be open, resolved, or dismissed",
    );
  }

  return text;
}


function normalizeListLimit(
  value,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return MANUAL_REVIEW_LIST_DEFAULT_LIMIT;
  }

  const number =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      number,
    ) ||
    number < 1 ||
    number >
      MANUAL_REVIEW_LIST_MAX_LIMIT
  ) {
    throw new TypeError(
      "limit must be an integer between 1 and 200",
    );
  }

  return number;
}


function nullableIso(
  value,
) {
  if (value == null) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? String(value)
    : date.toISOString();
}


function normalizeBaseTaskRow(
  row,
) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id ?? null,

    subject_id:
      row.subject_id ?? null,

    source_path:
      row.source_path ?? null,

    item_ref:
      row.item_ref ?? null,

    review_type:
      row.review_type ?? null,

    task_status:
      row.task_status ?? null,

    created_at:
      nullableIso(
        row.created_at,
      ),

    updated_at:
      nullableIso(
        row.updated_at,
      ),
  };
}


function normalizeTaskRow(
  row,
) {
  const task =
    normalizeBaseTaskRow(
      row,
    );

  if (!task) {
    return null;
  }

  return {
    ...task,

    occurrence_count:
      Number(
        row.occurrence_count ??
        0,
      ),

    latest_dossier_version_id:
      row.latest_dossier_version_id ??
      null,

    latest_occurrence_at:
      nullableIso(
        row.latest_occurrence_at,
      ),
  };
}


export async function listManualReviewTasks(
  {
    subjectId = null,
    taskStatus = "open",
    limit =
      MANUAL_REVIEW_LIST_DEFAULT_LIMIT,
  } = {},
  options = {},
) {
  const normalizedSubjectId =
    subjectId == null ||
    String(subjectId).trim() === ""
      ? null
      : requiredUuid(
          subjectId,
          "subjectId",
        );

  const normalizedTaskStatus =
    normalizeTaskStatus(
      taskStatus,
      {
        allowAll:
          true,
      },
    );

  const normalizedLimit =
    normalizeListLimit(
      limit,
    );

  const sql =
    options.sql ??
    db();

  const rows =
    await sql`
      SELECT
        task.id,
        task.subject_id,
        task.source_path,
        task.item_ref,
        task.review_type,
        task.task_status,
        task.created_at,
        task.updated_at,

        count(
          occurrence.id
        )::int AS occurrence_count,

        latest.dossier_version_id
          AS latest_dossier_version_id,

        latest.created_at
          AS latest_occurrence_at

      FROM manual_review_tasks
        AS task

      LEFT JOIN
        manual_review_task_occurrences
        AS occurrence
        ON occurrence.task_id =
          task.id

      LEFT JOIN LATERAL (
        SELECT
          item.dossier_version_id,
          item.created_at
        FROM
          manual_review_task_occurrences
          AS item
        WHERE
          item.task_id =
            task.id
        ORDER BY
          item.created_at DESC,
          item.id DESC
        LIMIT 1
      ) AS latest
        ON true

      WHERE (
        ${normalizedSubjectId}::uuid
          IS NULL
        OR task.subject_id =
          ${normalizedSubjectId}::uuid
      )
      AND (
        ${normalizedTaskStatus}::text
          IS NULL
        OR task.task_status =
          ${normalizedTaskStatus}::text
      )

      GROUP BY
        task.id,
        latest.dossier_version_id,
        latest.created_at

      ORDER BY
        task.updated_at DESC,
        task.created_at DESC,
        task.id DESC

      LIMIT
        ${normalizedLimit}
    `;

  return Array.isArray(
    rows,
  )
    ? rows
        .map(
          normalizeTaskRow,
        )
        .filter(
          Boolean,
        )
    : [];
}


export async function setManualReviewTaskStatus(
  {
    taskId,
    taskStatus,
  } = {},
  options = {},
) {
  const normalizedTaskId =
    requiredUuid(
      taskId,
      "taskId",
    );

  const normalizedTaskStatus =
    normalizeTaskStatus(
      taskStatus,
    );

  const sql =
    options.sql ??
    db();

  const rows =
    await sql`
      UPDATE manual_review_tasks
      SET
        task_status =
          ${normalizedTaskStatus},

        updated_at =
          now()

      WHERE id =
        ${normalizedTaskId}

      RETURNING
        id,
        subject_id,
        source_path,
        item_ref,
        review_type,
        task_status,
        created_at,
        updated_at
    `;

  const row =
    rows?.[0] ??
    null;

  if (!row) {
    return null;
  }

  return normalizeBaseTaskRow(
    row,
  );
}
