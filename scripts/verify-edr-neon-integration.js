import { randomUUID } from "node:crypto";

import { db } from "../src/db.js";

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
  runEdrSnapshotWithFailureGuard,
} from "../src/edr-snapshot-failure.js";

import {
  findActiveEdrRecords,
  findActiveEdrRelations,
} from "../src/edr-index.js";

import {
  resolveActiveEdrSubjectMatch,
} from "../src/edr-subject-resolution.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(
      `Integration assertion failed: ${message}`,
    );
  }
}

function baseRecord({
  recordType,
  recordNumber,
  name,
  edrpou = null,
  founders = [],
}) {
  return {
    schema_version:
      EDR_NORMALIZED_SCHEMA_VERSION,
    record_type:
      recordType,
    record_number:
      recordNumber,
    name,
    short_name: null,
    status: "active",
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
    authorized_capital: null,
    members: [],
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

async function restoreActiveSnapshot(
  sql,
  previousActive,
  testSnapshotId,
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

  if (testSnapshotId) {
    await sql`
      DELETE FROM edr_active_snapshot
      WHERE singleton = true
        AND snapshot_id =
          ${testSnapshotId}
    `;
  }
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
    WHERE id = ${snapshotId}
  `;
}

const sql = db();

const previousActive =
  await getActiveEdrSnapshot(sql);

const runId =
  `${Date.now()}-${randomUUID()}`;

let successSnapshotId = null;
let failureSnapshotId = null;

try {
  console.log(
    "=== SUCCESS PATH ===",
  );

  const successSnapshot =
    await createEdrSnapshot(
      sql,
      {
        versionKey:
          `integration-success-${runId}`,
        schemaVersion:
          EDR_NORMALIZED_SCHEMA_VERSION,
        metadata: {
          integration_test: true,
          run_id: runId,
        },
      },
    );

  successSnapshotId =
    successSnapshot.snapshot.id;

  assert(
    successSnapshot.created === true,
    "success snapshot must be newly created",
  );

  await registerEdrSnapshotResource(
    sql,
    {
      snapshotId:
        successSnapshotId,
      resourceType:
        "organization",
      resourceName:
        "integration-UO.zip",
      resourceId:
        `integration-uo-${runId}`,
      sourceUrl:
        "https://integration.invalid/UO.zip",
      expectedSize: 1,
      downloadedSize: 1,
      sha256:
        "a".repeat(64),
      metadata: {
        integration_test: true,
      },
    },
  );

  await registerEdrSnapshotResource(
    sql,
    {
      snapshotId:
        successSnapshotId,
      resourceType:
        "fop",
      resourceName:
        "integration-FOP.zip",
      resourceId:
        `integration-fop-${runId}`,
      sourceUrl:
        "https://integration.invalid/FOP.zip",
      expectedSize: 1,
      downloadedSize: 1,
      sha256:
        "b".repeat(64),
      metadata: {
        integration_test: true,
      },
    },
  );

  const organizationRecords = [
    baseRecord({
      recordType:
        "organization",
      recordNumber:
        `UO-${runId}-1`,
      name:
        "ТОВ ІНТЕГРАЦІЙНИЙ ТЕСТ ОДИН",
      edrpou:
        "00000001",
      founders: [
        "ІНТЕГРАЦІЙНИЙ ЗАСНОВНИК",
      ],
    }),
    baseRecord({
      recordType:
        "organization",
      recordNumber:
        `UO-${runId}-2`,
      name:
        "ТОВ ІНТЕГРАЦІЙНИЙ ТЕСТ ДВА",
      edrpou:
        "00000002",
    }),
  ];

  const organizationImport =
    await importEdrRecordStream(
      sql,
      organizationRecords,
      {
        snapshotId:
          successSnapshotId,
        batchSize: 1,
        startSequence: 0,
      },
    );

  assert(
    organizationImport.records_written ===
      2,
    "two organization records must be written",
  );

  await setEdrSnapshotResourceImportedCount(
    sql,
    {
      snapshotId:
        successSnapshotId,
      resourceType:
        "organization",
      importedCount:
        organizationImport.records_written,
    },
  );

  const fopRecords = [
    baseRecord({
      recordType:
        "fop",
      recordNumber:
        `FOP-${runId}-1`,
      name:
        "ІНТЕГРАЦІЙНИЙ ФОП",
    }),
  ];

  const fopImport =
    await importEdrRecordStream(
      sql,
      fopRecords,
      {
        snapshotId:
          successSnapshotId,
        batchSize: 1,
        startSequence:
          organizationImport.next_sequence,
      },
    );

  assert(
    fopImport.records_written === 1,
    "one FOP record must be written",
  );

  assert(
    fopImport.next_sequence === 3,
    "source sequence must continue across resources",
  );

  await setEdrSnapshotResourceImportedCount(
    sql,
    {
      snapshotId:
        successSnapshotId,
      resourceType:
        "fop",
      importedCount:
        fopImport.records_written,
    },
  );

  const relationCount =
    organizationImport.relations_written +
    fopImport.relations_written;

  const finalization =
    await finalizeEdrSnapshot(
      sql,
      {
        snapshotId:
          successSnapshotId,
        organizationCount: 2,
        fopCount: 1,
        relationCount,
      },
    );

  assert(
    finalization.validation.ok === true,
    "snapshot validation must succeed",
  );

  const activeAfterSuccess =
    await getActiveEdrSnapshot(sql);

  assert(
    activeAfterSuccess?.id ===
      successSnapshotId,
    "successful snapshot must become active",
  );

  console.log(
    "=== ACTIVE INDEX LOOKUPS ===",
  );

  const byName =
    await findActiveEdrRecords(
      sql,
      {
        name:
          "  ТОВ   ІНТЕГРАЦІЙНИЙ ТЕСТ ОДИН  ",
      },
    );

  const byEdrpou =
    await findActiveEdrRecords(
      sql,
      {
        edrpou: "00000001",
        recordType:
          "organization",
      },
    );

  const combined =
    await findActiveEdrRecords(
      sql,
      {
        name:
          "ТОВ ІНТЕГРАЦІЙНИЙ ТЕСТ ОДИН",
        edrpou: "00000001",
      },
    );

  const wrongCombined =
    await findActiveEdrRecords(
      sql,
      {
        name:
          "ТОВ ІНТЕГРАЦІЙНИЙ ТЕСТ ОДИН",
        edrpou: "99999999",
      },
    );

  const fopByName =
    await findActiveEdrRecords(
      sql,
      {
        name:
          "ІНТЕГРАЦІЙНИЙ ФОП",
        recordType: "fop",
      },
    );

  const founderMatches =
    await findActiveEdrRelations(
      sql,
      {
        value:
          "  ІНТЕГРАЦІЙНИЙ   ЗАСНОВНИК  ",
        relationTypes: [
          "founder",
        ],
      },
    );

  const wrongRelationType =
    await findActiveEdrRelations(
      sql,
      {
        value:
          "ІНТЕГРАЦІЙНИЙ ЗАСНОВНИК",
        relationTypes: [
          "beneficiary",
        ],
      },
    );

  assert(
    byName.length === 1 &&
      byName[0].snapshot_id ===
        successSnapshotId,
    "name lookup must return one active snapshot record",
  );

  assert(
    byEdrpou.length === 1 &&
      byEdrpou[0].edrpou ===
        "00000001",
    "EDRPOU lookup must return the organization",
  );

  assert(
    combined.length === 1,
    "combined name and EDRPOU lookup must match",
  );

  assert(
    wrongCombined.length === 0,
    "wrong combined lookup must not match",
  );

  assert(
    fopByName.length === 1 &&
      fopByName[0].record_type ===
        "fop",
    "FOP name lookup must match active FOP",
  );

  assert(
    founderMatches.length === 1 &&
      founderMatches[0].relation_type ===
        "founder" &&
      founderMatches[0].snapshot_id ===
        successSnapshotId,
    "founder relation lookup must match active snapshot",
  );

  assert(
    wrongRelationType.length === 0,
    "wrong relation type must not match",
  );

  console.log({
    by_name: byName.length,
    by_edrpou: byEdrpou.length,
    combined: combined.length,
    wrong_combined:
      wrongCombined.length,
    fop_by_name:
      fopByName.length,
    founder_matches:
      founderMatches.length,
    wrong_relation_type:
      wrongRelationType.length,
  });

  console.log(
    "EDR active index integration: PASS",
  );

  console.log(
    "=== ACTIVE SUBJECT MATCHING ===",
  );

  const matchedOrganization =
    await resolveActiveEdrSubjectMatch(
      sql,
      {
        name:
          "ТОВ ІНТЕГРАЦІЙНИЙ ТЕСТ ОДИН",
        edrpou:
          "00000001",
      },
    );

  assert(
    matchedOrganization.status ===
      "matched" &&
      matchedOrganization.decision ===
        "exact_stable_identifier" &&
      matchedOrganization.review_required ===
        false,
    "exact organization EDRPOU must auto-match",
  );

  assert(
    matchedOrganization.best?.snapshotId ===
      successSnapshotId &&
      matchedOrganization.best?.recordType ===
        "organization" &&
      matchedOrganization.best?.hardMatch ===
        true,
    "organization match must come from active snapshot hard evidence",
  );

  assert(
    matchedOrganization.retrieval?.record_count ===
      1,
    "duplicate name and EDRPOU retrieval must collapse to one record",
  );

  const ambiguousFop =
    await resolveActiveEdrSubjectMatch(
      sql,
      {
        fullName:
          "  ІНТЕГРАЦІЙНИЙ   ФОП  ",
      },
    );

  assert(
    ambiguousFop.status ===
      "ambiguous" &&
      ambiguousFop.decision ===
        "manual_review" &&
      ambiguousFop.review_required ===
        true,
    "exact FOP name must require manual review",
  );

  assert(
    ambiguousFop.best?.recordType ===
      "fop" &&
      ambiguousFop.best?.hardMatch ===
        false,
    "FOP name-only evidence must never become hard match",
  );

  const ambiguousFounder =
    await resolveActiveEdrSubjectMatch(
      sql,
      {
        fullName:
          "  ІНТЕГРАЦІЙНИЙ   ЗАСНОВНИК  ",
      },
    );

  assert(
    ambiguousFounder.status ===
      "ambiguous" &&
      ambiguousFounder.decision ===
        "manual_review",
    "founder name relation must require manual review",
  );

  assert(
    ambiguousFounder.best?.candidateKind ===
      "relation" &&
      ambiguousFounder.best?.relationType ===
        "founder" &&
      ambiguousFounder.best?.snapshotId ===
        successSnapshotId,
    "founder evidence must come from active snapshot relation",
  );

  const conflictingOrganization =
    await resolveActiveEdrSubjectMatch(
      sql,
      {
        name:
          "ТОВ ІНТЕГРАЦІЙНИЙ ТЕСТ ОДИН",
        edrpou:
          "99999999",
      },
    );

  assert(
    conflictingOrganization.status ===
      "conflict" &&
      conflictingOrganization.decision ===
        "manual_review" &&
      conflictingOrganization.review_required ===
        true,
    "name match with contradictory EDRPOU must become conflict",
  );

  assert(
    conflictingOrganization.conflicts?.length ===
      1,
    "contradictory EDRPOU must expose one conflict candidate",
  );

  const missingSubject =
    await resolveActiveEdrSubjectMatch(
      sql,
      {
        fullName:
          "НЕІСНУЮЧИЙ ІНТЕГРАЦІЙНИЙ СУБЄКТ",
      },
    );

  assert(
    missingSubject.status ===
      "unmatched" &&
      missingSubject.decision ===
        "no_match" &&
      missingSubject.review_required ===
        false,
    "missing subject must remain unmatched",
  );

  const activeAfterSubjectMatching =
    await getActiveEdrSnapshot(sql);

  assert(
    activeAfterSubjectMatching?.id ===
      successSnapshotId,
    "subject matching must not change active snapshot",
  );

  console.log({
    organization:
      matchedOrganization.status,
    fop:
      ambiguousFop.status,
    founder:
      ambiguousFounder.status,
    conflicting_edrpou:
      conflictingOrganization.status,
    missing:
      missingSubject.status,
  });

  console.log(
    "EDR subject matching integration: PASS",
  );

  const [successState] =
    await sql`
      SELECT
        status,
        organization_count::int
          AS organization_count,
        fop_count::int
          AS fop_count,
        relation_count::int
          AS relation_count
      FROM edr_snapshots
      WHERE id =
        ${successSnapshotId}
    `;

  assert(
    successState?.status === "ready",
    "successful snapshot must be ready",
  );

  assert(
    successState.organization_count === 2,
    "stored organization count must equal 2",
  );

  assert(
    successState.fop_count === 1,
    "stored FOP count must equal 1",
  );

  assert(
    successState.relation_count ===
      relationCount,
    "stored relation count must match importer",
  );

  console.log({
    success_snapshot:
      successSnapshotId,
    organizations: 2,
    fops: 1,
    relations:
      relationCount,
    source_sequence_next:
      fopImport.next_sequence,
  });

  console.log(
    "=== FAILURE PATH ===",
  );

  const failureSnapshot =
    await createEdrSnapshot(
      sql,
      {
        versionKey:
          `integration-failure-${runId}`,
        schemaVersion:
          EDR_NORMALIZED_SCHEMA_VERSION,
        metadata: {
          integration_test: true,
          run_id: runId,
        },
      },
    );

  failureSnapshotId =
    failureSnapshot.snapshot.id;

  let expectedFailureSeen = false;

  try {
    await runEdrSnapshotWithFailureGuard(
      sql,
      {
        snapshotId:
          failureSnapshotId,
        work:
          async () => {
            throw new Error(
              "synthetic integration failure",
            );
          },
      },
    );
  } catch (error) {
    expectedFailureSeen =
      error?.message ===
        "synthetic integration failure";
  }

  assert(
    expectedFailureSeen,
    "original failure must propagate",
  );

  const [failureState] =
    await sql`
      SELECT
        status,
        error_text
      FROM edr_snapshots
      WHERE id =
        ${failureSnapshotId}
    `;

  assert(
    failureState?.status === "failed",
    "failed work must mark staging snapshot failed",
  );

  assert(
    failureState.error_text ===
      "synthetic integration failure",
    "failure message must be stored",
  );

  const activeAfterFailure =
    await getActiveEdrSnapshot(sql);

  assert(
    activeAfterFailure?.id ===
      successSnapshotId,
    "failed snapshot must not replace active snapshot",
  );

  console.log({
    failed_snapshot:
      failureSnapshotId,
    active_snapshot_unchanged:
      activeAfterFailure.id,
  });

  console.log(
    "EDR Neon integration: PASS",
  );
} finally {
  console.log(
    "=== CLEANUP ===",
  );

  await restoreActiveSnapshot(
    sql,
    previousActive,
    successSnapshotId,
  );

  await deleteSnapshot(
    sql,
    failureSnapshotId,
  );

  await deleteSnapshot(
    sql,
    successSnapshotId,
  );

  const activeAfterCleanup =
    await getActiveEdrSnapshot(sql);

  assert(
    (activeAfterCleanup?.id ?? null) ===
      (previousActive?.id ?? null),
    "cleanup must restore previous active snapshot",
  );

  const [leftovers] =
    await sql`
      SELECT
        (
          SELECT count(*)::int
          FROM edr_snapshots
          WHERE metadata ->>
            'run_id' =
            ${runId}
        ) AS snapshots,
        (
          SELECT count(*)::int
          FROM edr_records r
          JOIN edr_snapshots s
            ON s.id = r.snapshot_id
          WHERE s.metadata ->>
            'run_id' =
            ${runId}
        ) AS records
    `;

  assert(
    leftovers.snapshots === 0,
    "integration snapshots must be removed",
  );

  assert(
    leftovers.records === 0,
    "integration records must be removed",
  );

  console.log({
    restored_active_snapshot:
      activeAfterCleanup?.id ?? null,
    integration_snapshots_left:
      leftovers.snapshots,
    integration_records_left:
      leftovers.records,
  });
}
