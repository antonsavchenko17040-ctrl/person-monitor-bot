import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../src/db.js";

import {
  normalizeText,
} from "../src/utils.js";

import {
  EDR_NORMALIZED_SCHEMA_VERSION,
} from "../src/edr-normalizer.js";

import {
  createEdrSnapshot,
  registerEdrSnapshotResource,
  getActiveEdrSnapshot,
} from "../src/edr-snapshot-store.js";

import {
  importEdrRecordStream,
} from "../src/edr-stream-importer.js";

import {
  setEdrSnapshotResourceImportedCount,
} from "../src/edr-snapshot-validator.js";

import {
  finalizeEdrSnapshot,
} from "../src/edr-snapshot-finalizer.js";

import {
  compareEdrSnapshots,
} from "../src/edr-snapshot-compare.js";

import {
  compareEdrSnapshotRelations,
} from "../src/edr-snapshot-relations.js";

import {
  findSubjectsForEdrRecheck,
} from "../src/edr-recheck-planner.js";

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      "Integration assertion failed: " +
      message,
    );
  }
}

function baseRecord({
  recordNumber,
  name,
  edrpou,
  status = "active",
  founders = [],
} = {}) {
  return {
    schema_version:
      EDR_NORMALIZED_SCHEMA_VERSION,

    record_type:
      "organization",

    record_number:
      recordNumber,

    name,
    short_name: null,

    status,
    edrpou,

    legal_form: null,
    registration: null,
    farmer: null,
    estate_manager: null,
    founding_document_number: null,
    executive_power: null,
    purpose: null,

    founders,
    beneficiaries: [],
    superior_management: null,
    signers: [],
    members: [],

    authorized_capital: null,
    statute: null,
    managing_paper: null,
    branches: [],
    termination_started: null,
    bankruptcy_readjustment: null,
    predecessors: [],
    assignees: [],
    terminated_info: null,
    termination_cancel_info: null,
    exchange_answers: [],
  };
}

async function registerResources(
  sql,
  snapshotId,
  label,
) {
  await registerEdrSnapshotResource(
    sql,
    {
      snapshotId,

      resourceType:
        "organization",

      resourceName:
        label + "-UO.zip",

      resourceId:
        label + "-uo",

      sourceUrl:
        "https://integration.invalid/UO.zip",

      expectedSize: 1,
      downloadedSize: 1,

      sha256:
        "a".repeat(64),

      metadata: {
        integration_test: true,
        label,
      },
    },
  );

  await registerEdrSnapshotResource(
    sql,
    {
      snapshotId,

      resourceType:
        "fop",

      resourceName:
        label + "-FOP.zip",

      resourceId:
        label + "-fop",

      sourceUrl:
        "https://integration.invalid/FOP.zip",

      expectedSize: 1,
      downloadedSize: 1,

      sha256:
        "b".repeat(64),

      metadata: {
        integration_test: true,
        label,
      },
    },
  );
}

async function createReadySnapshot(
  sql,
  {
    runId,
    label,
    record,
  },
) {
  const created =
    await createEdrSnapshot(
      sql,
      {
        versionKey:
          label + "-" + runId,

        schemaVersion:
          EDR_NORMALIZED_SCHEMA_VERSION,

        metadata: {
          integration_test: true,
          run_id: runId,
          label,
        },
      },
    );

  const snapshotId =
    created.snapshot.id;

  assert(
    created.created === true,
    label +
      " snapshot must be newly created",
  );

  await registerResources(
    sql,
    snapshotId,
    label + "-" + runId,
  );

  const imported =
    await importEdrRecordStream(
      sql,
      [record],
      {
        snapshotId,
        batchSize: 1,
        startSequence: 0,
      },
    );

  assert(
    imported.records_written === 1,
    label +
      " must contain one organization",
  );

  await setEdrSnapshotResourceImportedCount(
    sql,
    {
      snapshotId,
      resourceType:
        "organization",
      importedCount: 1,
    },
  );

  await setEdrSnapshotResourceImportedCount(
    sql,
    {
      snapshotId,
      resourceType:
        "fop",
      importedCount: 0,
    },
  );

  const finalized =
    await finalizeEdrSnapshot(
      sql,
      {
        snapshotId,
        organizationCount: 1,
        fopCount: 0,

        relationCount:
          imported.relations_written,
      },
    );

  assert(
    finalized.validation.ok === true,
    label +
      " snapshot validation must pass",
  );

  return {
    snapshotId,

    relationCount:
      imported.relations_written,
  };
}


async function restoreActiveSnapshot(
  sql,
  previousActive,
  oldSnapshotId,
  newSnapshotId,
) {
  if (previousActive?.id) {
    await sql`
      INSERT INTO edr_active_snapshot (
        singleton,
        snapshot_id,
        activated_at
      )
      VALUES (
        true,
        ${previousActive.id},
        now()
      )
      ON CONFLICT (singleton)
      DO UPDATE SET
        snapshot_id =
          EXCLUDED.snapshot_id,
        activated_at =
          EXCLUDED.activated_at
    `;

    return;
  }

  await sql`
    DELETE FROM edr_active_snapshot
    WHERE singleton = true
      AND (
        snapshot_id =
          ${oldSnapshotId}
        OR snapshot_id =
          ${newSnapshotId}
      )
  `;
}

async function deleteSnapshot(
  sql,
  snapshotId,
) {
  if (!snapshotId) {
    return;
  }

  await sql`
    DELETE FROM edr_snapshots
    WHERE id =
      ${snapshotId}
  `;
}

const sql =
  db();

const previousActive =
  await getActiveEdrSnapshot(
    sql,
  );

const runId =
  Date.now() +
  "-" +
  randomUUID();

const token =
  randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);

const edrpou =
  String(
    10000000 +
    (
      Number.parseInt(
        token.slice(0, 8),
        16,
      ) %
      90000000
    ),
  );

const subjectName =
  "ІНТЕГРАЦІЙНИЙ СУБЄКТ " +
  token;

const otherName =
  "ІНША ІНТЕГРАЦІЙНА ОСОБА " +
  token;

const organizationName =
  "ТОВ ІНТЕГРАЦІЙНА ОРГАНІЗАЦІЯ " +
  token;

const subjectId =
  randomUUID();

const subjectEntityId =
  randomUUID();

const organizationEntityId =
  randomUUID();

const organizationIdentifierId =
  randomUUID();

const graphRelationId =
  randomUUID();

let oldSnapshotId =
  null;

let newSnapshotId =
  null;

try {
  console.log(
    "=== СТВОРЕННЯ SYNTHETIC ДАНИХ ===",
  );

  await sql`
    INSERT INTO entities (
      id,
      entity_type,
      canonical_name,
      normalized_name,
      status,
      metadata
    )
    VALUES (
      ${subjectEntityId},
      ${"person"},
      ${subjectName},
      ${normalizeText(
        subjectName,
      )},
      ${"active"},
      ${JSON.stringify({
        integration_test: true,
        run_id: runId,
      })}::jsonb
    )
  `;

  await sql`
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
      last_checked_at,
      entity_id
    )
    VALUES (
      ${subjectId},
      NULL,
      ${subjectName},
      ${JSON.stringify([])}::jsonb,
      ${organizationName},
      ${"Інтеграційна посада"},
      ${"Київ"},
      ${JSON.stringify([])}::jsonb,
      70,
      true,
      now(),
      NULL,
      ${subjectEntityId}
    )
  `;

  await sql`
    INSERT INTO entities (
      id,
      entity_type,
      canonical_name,
      normalized_name,
      status,
      metadata
    )
    VALUES (
      ${organizationEntityId},
      ${"organization"},
      ${organizationName},
      ${normalizeText(
        organizationName,
      )},
      ${"active"},
      ${JSON.stringify({
        integration_test: true,
        run_id: runId,
        source: "edr",
        edrpou,
      })}::jsonb
    )
  `;

  await sql`
    INSERT INTO entity_identifiers (
      id,
      entity_id,
      identifier_type,
      identifier_value,
      normalized_value,
      source,
      confidence,
      is_primary,
      metadata
    )
    VALUES (
      ${organizationIdentifierId},
      ${organizationEntityId},
      ${"edrpou"},
      ${edrpou},
      ${edrpou},
      ${"edr"},
      100,
      true,
      ${JSON.stringify({
        integration_test: true,
        run_id: runId,
        source: "edr",
      })}::jsonb
    )
  `;

  await sql`
    INSERT INTO relations (
      id,
      from_entity_id,
      to_entity_id,
      relation_type,
      source_document_id,
      valid_from,
      valid_to,
      confidence,
      verification_status,
      metadata
    )
    VALUES (
      ${graphRelationId},
      ${subjectEntityId},
      ${organizationEntityId},
      ${"edr_founder_of"},
      NULL,
      NULL,
      NULL,
      80,
      ${"manual_review"},
      ${JSON.stringify({
        integration_test: true,
        run_id: runId,
        source: "edr",
        organization_edrpou:
          edrpou,
      })}::jsonb
    )
  `;


  console.log(
    "=== OLD SNAPSHOT ===",
  );

  const oldReady =
    await createReadySnapshot(
      sql,
      {
        runId,
        label:
          "integration-old",

        record:
          baseRecord({
            recordNumber:
              "OLD-" + token,

            name:
              organizationName,

            edrpou,

            status:
              "active",

            founders: [
              subjectName,
            ],
          }),
      },
    );

  oldSnapshotId =
    oldReady.snapshotId;

  console.log(
    "=== NEW SNAPSHOT ===",
  );

  const newReady =
    await createReadySnapshot(
      sql,
      {
        runId,
        label:
          "integration-new",

        record:
          baseRecord({
            recordNumber:
              "NEW-" + token,

            name:
              organizationName,

            edrpou,

            status:
              "active",

            founders: [
              otherName,
            ],
          }),
      },
    );

  newSnapshotId =
    newReady.snapshotId;

  const activeAfterNew =
    await getActiveEdrSnapshot(
      sql,
    );

  assert(
    activeAfterNew?.id ===
      newSnapshotId,
    "new snapshot must become active",
  );

  console.log(
    "=== ПОРІВНЯННЯ ЗАПИСІВ ===",
  );

  const recordComparison =
    await compareEdrSnapshots(
      sql,
      {
        oldSnapshotId,
        newSnapshotId,
      },
    );

  assert(
    recordComparison
      .organizations
      .summary
      .changed === 1,
    "organization must be classified as changed",
  );

  assert(
    recordComparison
      .organizations
      .summary
      .added === 0,
    "organization must not be classified as added",
  );

  assert(
    recordComparison
      .organizations
      .summary
      .removed === 0,
    "organization must not be classified as removed",
  );

  console.log(
    "=== ПОРІВНЯННЯ ЗВЯЗКІВ ===",
  );

  const relationComparison =
    await compareEdrSnapshotRelations(
      sql,
      {
        oldSnapshotId,
        newSnapshotId,
      },
    );

  assert(
    relationComparison
      .comparison
      .summary
      .removed === 1,
    "old founder relation must be removed",
  );

  assert(
    relationComparison
      .comparison
      .summary
      .added === 1,
    "new founder relation must be added",
  );

  console.log(
    "=== ПЛАН ПОВТОРНОЇ ПЕРЕВІРКИ ===",
  );

  const recheck =
    await findSubjectsForEdrRecheck(
      sql,
      {
        recordComparison,
        relationComparison,
      },
    );

  assert(
    recheck.summary.subjects ===
      1,
    "exactly one synthetic subject must be selected",
  );

  const selected =
    recheck.subjects[0];

  assert(
    selected.id ===
      subjectId,
    "selected subject id must match synthetic subject",
  );

  assert(
    selected.reasons.includes(
      "exact_subject_name_match",
    ),
    "exact name signal must select the subject",
  );

  assert(
    selected.reasons.includes(
      "existing_edr_graph_link",
    ),
    "existing EDR graph link must select the subject",
  );

  assert(
    selected.reasons.includes(
      "organization_changed",
    ),
    "organization change reason must be preserved",
  );

  assert(
    selected.reasons.includes(
      "relation_removed",
    ),
    "removed relation reason must be preserved",
  );

  assert(
    selected.matched_edrpous.includes(
      edrpou,
    ),
    "changed organization EDRPOU must be preserved",
  );

  assert(
    selected.matched_names.includes(
      normalizeText(
        subjectName,
      ),
    ),
    "matched subject name must be preserved",
  );

  console.log({
    old_snapshot:
      oldSnapshotId,

    new_snapshot:
      newSnapshotId,

    organization_edrpou:
      edrpou,

    organization_changes:
      recordComparison
        .organizations
        .summary
        .changed,

    relations_added:
      relationComparison
        .comparison
        .summary
        .added,

    relations_removed:
      relationComparison
        .comparison
        .summary
        .removed,

    subjects_for_recheck:
      recheck.summary.subjects,

    selected_subject:
      selected.full_name,

    reasons:
      selected.reasons,
  });

  console.log(
    "EDR snapshot change integration: PASS",
  );


} finally {
  console.log(
    "=== ОЧИЩЕННЯ ===",
  );

  await restoreActiveSnapshot(
    sql,
    previousActive,
    oldSnapshotId,
    newSnapshotId,
  );

  await deleteSnapshot(
    sql,
    newSnapshotId,
  );

  await deleteSnapshot(
    sql,
    oldSnapshotId,
  );

  await sql`
    DELETE FROM subjects
    WHERE id =
      ${subjectId}
  `;

  await sql`
    DELETE FROM relations
    WHERE id =
      ${graphRelationId}
  `;

  await sql`
    DELETE FROM entity_identifiers
    WHERE id =
      ${organizationIdentifierId}
  `;

  await sql`
    DELETE FROM entities
    WHERE id =
      ${organizationEntityId}
      OR id =
      ${subjectEntityId}
  `;

  const activeAfterCleanup =
    await getActiveEdrSnapshot(
      sql,
    );

  assert(
    (
      activeAfterCleanup?.id ??
      null
    ) ===
      (
        previousActive?.id ??
        null
      ),
    "cleanup must restore previous active snapshot",
  );

  const [leftovers] =
    await sql`
      SELECT
        (
          SELECT count(*)::int
          FROM edr_snapshots
          WHERE metadata
            ->> ${"run_id"} =
            ${runId}
        ) AS snapshots,

        (
          SELECT count(*)::int
          FROM subjects
          WHERE id =
            ${subjectId}
        ) AS subjects,

        (
          SELECT count(*)::int
          FROM entities
          WHERE metadata
            ->> ${"run_id"} =
            ${runId}
        ) AS entities,

        (
          SELECT count(*)::int
          FROM relations
          WHERE metadata
            ->> ${"run_id"} =
            ${runId}
        ) AS relations,

        (
          SELECT count(*)::int
          FROM entity_identifiers
          WHERE metadata
            ->> ${"run_id"} =
            ${runId}
        ) AS identifiers
    `;

  assert(
    leftovers.snapshots === 0,
    "cleanup must delete synthetic snapshots",
  );

  assert(
    leftovers.subjects === 0,
    "cleanup must delete synthetic subject",
  );

  assert(
    leftovers.entities === 0,
    "cleanup must delete synthetic entities",
  );

  assert(
    leftovers.relations === 0,
    "cleanup must delete synthetic graph relation",
  );

  assert(
    leftovers.identifiers === 0,
    "cleanup must delete synthetic identifier",
  );

  console.log({
    previous_active_restored:
      activeAfterCleanup?.id ??
      null,

    leftovers,
  });

  console.log(
    "EDR snapshot change cleanup: PASS",
  );
}
