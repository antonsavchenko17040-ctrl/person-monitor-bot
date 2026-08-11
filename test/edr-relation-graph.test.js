import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_GRAPH_RELATION_TYPES,
  buildEdrSubjectRelationPlan,
} from "../src/edr-relation-graph.js";

import {
  deterministicUuid,
} from "../src/graph-builder.js";

function relationRow(
  overrides = {},
) {
  return {
    id: "observation-1",
    snapshot_id: "snapshot-1",
    record_id: "record-1",
    relation_type: "founder",
    value_text:
      "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    normalized_value:
      "іваненко іван іванович",
    record_type: "organization",
    record_name: "ТОВ ТЕСТ",
    record_edrpou: "12345678",
    ...overrides,
  };
}

function candidate(
  overrides = {},
) {
  return {
    candidateKind: "relation",
    candidateId: "observation-1",
    recordId: "record-1",
    snapshotId: "snapshot-1",
    recordType: "organization",
    relationType: "founder",
    score: 70,
    level: "probable",
    hardMatch: false,
    conflict: false,
    reasons: [
      "Точний збіг ПІБ у звязку founder",
    ],
    ...overrides,
  };
}

function resolution({
  relations = [relationRow()],
  candidates = [candidate()],
  status = "ambiguous",
  decision = "manual_review",
} = {}) {
  return {
    status,
    decision,
    best:
      candidates[0] ?? null,
    candidates,
    relations,
  };
}

test("exports canonical EDR graph relation mapping", () => {
  assert.deepEqual(
    EDR_GRAPH_RELATION_TYPES,
    {
      founder: "edr_founder_of",
      beneficiary:
        "edr_beneficiary_of",
      signer: "edr_signer_of",
      member: "edr_member_of",
      executive_power:
        "edr_executive_power_of",
      superior_management:
        "edr_superior_management_of",
    },
  );
});

test("requires subject entity id", () => {
  assert.throws(
    () =>
      buildEdrSubjectRelationPlan({
        resolution:
          resolution(),
      }),
    /subjectEntityId is required/,
  );
});

test("requires resolution arrays", () => {
  assert.throws(
    () =>
      buildEdrSubjectRelationPlan({
        subjectEntityId:
          "subject-1",
        resolution: {},
      }),
    /resolution relations and candidates are required/,
  );
});

test("maps founder evidence to manual-review organization relation", () => {
  const plan =
    buildEdrSubjectRelationPlan({
      subjectEntityId:
        "subject-1",
      resolution:
        resolution(),
    });

  assert.equal(
    plan.version,
    "edr-relations-v1",
  );

  assert.equal(
    plan.nodes.length,
    1,
  );

  assert.equal(
    plan.relations.length,
    1,
  );

  const node =
    plan.nodes[0];

  assert.equal(
    node.entityType,
    "organization",
  );

  assert.equal(
    node.canonicalName,
    "ТОВ ТЕСТ",
  );

  assert.equal(
    node.identifier.normalized,
    "12345678",
  );

  assert.equal(
    node.id,
    deterministicUuid(
      "organization:edrpou:12345678",
    ),
  );

  const edge =
    plan.relations[0];

  assert.equal(
    edge.fromEntityId,
    "subject-1",
  );

  assert.equal(
    edge.toEntityId,
    node.id,
  );

  assert.equal(
    edge.relationType,
    "edr_founder_of",
  );

  assert.equal(
    edge.verificationStatus,
    "manual_review",
  );

  assert.equal(
    edge.confidence,
    70,
  );

  assert.equal(
    edge.metadata.source,
    "edr",
  );

  assert.equal(
    edge.metadata.review_required,
    true,
  );

  assert.equal(
    plan.stats.manualReviewRelations,
    1,
  );
});

test("merges duplicate observations for same subject organization and relation", () => {
  const first =
    relationRow();

  const second =
    relationRow({
      id: "observation-2",
      snapshot_id:
        "snapshot-2",
    });

  const plan =
    buildEdrSubjectRelationPlan({
      subjectEntityId:
        "subject-1",
      resolution:
        resolution({
          relations: [
            first,
            second,
          ],
          candidates: [
            candidate(),
            candidate({
              candidateId:
                "observation-2",
              snapshotId:
                "snapshot-2",
              score: 75,
            }),
          ],
        }),
    });

  assert.equal(
    plan.nodes.length,
    1,
  );

  assert.equal(
    plan.relations.length,
    1,
  );

  const edge =
    plan.relations[0];

  assert.equal(
    edge.confidence,
    75,
  );

  assert.deepEqual(
    edge.metadata.observation_ids,
    [
      "observation-1",
      "observation-2",
    ],
  );

  assert.deepEqual(
    edge.metadata.snapshot_ids,
    [
      "snapshot-1",
      "snapshot-2",
    ],
  );

  assert.equal(
    edge.metadata.evidence_count,
    2,
  );
});

test("skips weak relation candidate", () => {
  const plan =
    buildEdrSubjectRelationPlan({
      subjectEntityId:
        "subject-1",
      resolution:
        resolution({
          candidates: [
            candidate({
              score: 54,
              level: "rejected",
            }),
          ],
        }),
    });

  assert.equal(
    plan.nodes.length,
    0,
  );

  assert.equal(
    plan.relations.length,
    0,
  );

  assert.equal(
    plan.stats.skippedWeakCandidate,
    1,
  );
});

test("skips unsupported EDR relation type", () => {
  const plan =
    buildEdrSubjectRelationPlan({
      subjectEntityId:
        "subject-1",
      resolution:
        resolution({
          relations: [
            relationRow({
              relation_type:
                "branch",
            }),
          ],
          candidates: [
            candidate({
              relationType:
                "branch",
            }),
          ],
        }),
    });

  assert.equal(
    plan.relations.length,
    0,
  );

  assert.equal(
    plan.stats.skippedUnsupported,
    1,
  );
});

test("defers organization relation without valid EDRPOU", () => {
  const plan =
    buildEdrSubjectRelationPlan({
      subjectEntityId:
        "subject-1",
      resolution:
        resolution({
          relations: [
            relationRow({
              record_edrpou:
                null,
            }),
          ],
        }),
    });

  assert.equal(
    plan.nodes.length,
    0,
  );

  assert.equal(
    plan.relations.length,
    0,
  );

  assert.equal(
    plan.stats.deferredWithoutEdrpou,
    1,
  );
});

test("different supported relation types reuse organization node but create distinct edges", () => {
  const founder =
    relationRow();

  const signer =
    relationRow({
      id: "observation-2",
      relation_type:
        "signer",
    });

  const plan =
    buildEdrSubjectRelationPlan({
      subjectEntityId:
        "subject-1",
      resolution:
        resolution({
          relations: [
            founder,
            signer,
          ],
          candidates: [
            candidate(),
            candidate({
              candidateId:
                "observation-2",
              relationType:
                "signer",
            }),
          ],
        }),
    });

  assert.equal(
    plan.nodes.length,
    1,
  );

  assert.equal(
    plan.relations.length,
    2,
  );

  assert.deepEqual(
    plan.relations
      .map(
        (item) =>
          item.relationType,
      )
      .sort(),
    [
      "edr_founder_of",
      "edr_signer_of",
    ],
  );

  assert.equal(
    plan.stats.organizations,
    1,
  );

  assert.equal(
    plan.stats.relations,
    2,
  );
});
