import { db } from '../src/db.js';

const sql = db();

const verifyOnly =
  process.argv.includes('--verify-only');


async function verify() {
  const tableRows =
    await sql`
      SELECT
        to_regclass(
          'public.manual_review_tasks'
        ) AS tasks_table,

        to_regclass(
          'public.manual_review_task_occurrences'
        ) AS occurrences_table
    `;

  const tasksExist =
    Boolean(
      tableRows?.[0]?.tasks_table,
    );

  const occurrencesExist =
    Boolean(
      tableRows?.[0]?.occurrences_table,
    );

  let taskCount = 0;
  let occurrenceCount = 0;

  if (tasksExist) {
    const rows =
      await sql`
        SELECT
          count(*)::int AS count
        FROM manual_review_tasks
      `;

    taskCount =
      rows?.[0]?.count ?? 0;
  }

  if (occurrencesExist) {
    const rows =
      await sql`
        SELECT
          count(*)::int AS count
        FROM manual_review_task_occurrences
      `;

    occurrenceCount =
      rows?.[0]?.count ?? 0;
  }

  console.log(
    'Manual review schema verification:',
  );

  console.table([
    {
      manual_review_tasks_exists:
        tasksExist,

      manual_review_tasks:
        taskCount,

      manual_review_occurrences_exists:
        occurrencesExist,

      manual_review_occurrences:
        occurrenceCount,
    },
  ]);

  return (
    tasksExist &&
    occurrencesExist
  );
}


if (verifyOnly) {
  const valid =
    await verify();

  if (valid === false) {
    process.exitCode = 1;
  }
} else {
  console.log(
    'Starting manual review schema migration...',
  );

  /*
   * Logical human-review tasks.
   *
   * A task is stable across dossier snapshots.
   * Re-generating a dossier must not create another open
   * task for the same review target.
   *
   * No PII, facts, evidence, URLs, article text, or
   * automated media review state are copied here.
   */
  await sql`
    CREATE TABLE IF NOT EXISTS
      manual_review_tasks (
        id uuid
          PRIMARY KEY
          DEFAULT gen_random_uuid(),

        subject_id uuid
          NOT NULL
          REFERENCES subjects(id)
          ON DELETE CASCADE,

        source_path text
          NOT NULL
          CHECK (
            source_path IN (
              'related_people.items',
              'relations.items'
            )
          ),

        item_ref text
          NOT NULL
          CHECK (
            length(
              btrim(item_ref)
            ) > 0
          ),

        review_type text
          NOT NULL
          CHECK (
            review_type =
              'identity_resolution'
          ),

        task_status text
          NOT NULL
          DEFAULT 'open'
          CHECK (
            task_status IN (
              'open',
              'resolved',
              'dismissed'
            )
          ),

        created_at timestamptz
          NOT NULL
          DEFAULT now(),

        updated_at timestamptz
          NOT NULL
          DEFAULT now(),

        UNIQUE (
          subject_id,
          source_path,
          item_ref,
          review_type
        )
      )
  `;

  console.log(
    '✓ manual_review_tasks',
  );

  /*
   * Snapshot occurrences preserve audit provenance without
   * duplicating the logical human-review task.
   *
   * Store-layer code must verify that task.subject_id and
   * dossier_versions.subject_id match before creating a link.
   */
  await sql`
    CREATE TABLE IF NOT EXISTS
      manual_review_task_occurrences (
        id uuid
          PRIMARY KEY
          DEFAULT gen_random_uuid(),

        task_id uuid
          NOT NULL
          REFERENCES manual_review_tasks(id)
          ON DELETE CASCADE,

        dossier_version_id uuid
          NOT NULL
          REFERENCES dossier_versions(id)
          ON DELETE CASCADE,

        manifest_version text
          NOT NULL
          CHECK (
            length(
              btrim(manifest_version)
            ) > 0
          ),

        created_at timestamptz
          NOT NULL
          DEFAULT now(),

        UNIQUE (
          task_id,
          dossier_version_id
        )
      )
  `;

  console.log(
    '✓ manual_review_task_occurrences',
  );

  await sql`
    CREATE INDEX IF NOT EXISTS
      manual_review_tasks_status_created_idx
    ON manual_review_tasks (
      task_status,
      created_at DESC
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      manual_review_tasks_subject_status_idx
    ON manual_review_tasks (
      subject_id,
      task_status,
      created_at DESC
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      manual_review_occurrences_dossier_idx
    ON manual_review_task_occurrences (
      dossier_version_id,
      created_at DESC
    )
  `;

  console.log(
    '✓ manual review indexes',
  );

  await verify();

  console.log(
    '\nManual review schema migration completed successfully.',
  );
}
