import {
  deterministicUuid,
  normalizeEdrpou,
} from "./graph-builder.js";

const VERSION =
  "edr-relations-v1";

export const EDR_GRAPH_RELATION_TYPES =
  Object.freeze({
    founder:
      "edr_founder_of",
    beneficiary:
      "edr_beneficiary_of",
    signer:
      "edr_signer_of",
    member:
      "edr_member_of",
    executive_power:
      "edr_executive_power_of",
    superior_management:
      "edr_superior_management_of",
  });

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function candidateMap(
  candidates,
) {
  const result =
    new Map();

  for (
    const candidate
    of candidates ?? []
  ) {
    if (
      candidate?.candidateKind !==
        "relation" ||
      candidate?.conflict === true ||
      candidate?.hardMatch === true ||
      Number(candidate?.score) < 55
    ) {
      continue;
    }

    result.set(
      String(
        candidate.candidateId ??
        "",
      ),
      candidate,
    );
  }

  return result;
}

function organizationNode(
  relation,
) {
  const edrpou =
    normalizeEdrpou(
      relation?.record_edrpou,
    );

  const name =
    clean(
      relation?.record_name,
    );

  if (
    !edrpou ||
    !name
  ) {
    return null;
  }

  const nodeKey =
    `organization:edrpou:${edrpou}`;

  return {
    nodeKey,

    id:
      deterministicUuid(
        nodeKey,
      ),

    entityType:
      "organization",

    canonicalName:
      name,

    identifier: {
      type: "edrpou",
      value: edrpou,
      normalized: edrpou,
      confidence: 100,
    },

    sourceDocumentId:
      null,

    metadata: {
      graph_version:
        VERSION,

      source:
        "edr",

      identification:
        "edrpou",

      edrpou,
    },
  };
}

function relationKey(
  subjectEntityId,
  organizationId,
  relationType,
) {
  return [
    VERSION,
    subjectEntityId,
    organizationId,
    relationType,
  ].join("|");
}

function mergeUnique(
  left,
  right,
) {
  return [
    ...new Set([
      ...(left ?? []),
      ...(right ?? []),
    ].filter(Boolean)),
  ].sort();
}

export function buildEdrSubjectRelationPlan({
  subjectEntityId,
  resolution,
} = {}) {
  const subjectId =
    clean(subjectEntityId);

  if (!subjectId) {
    throw new TypeError(
      "subjectEntityId is required",
    );
  }

  if (
    !resolution ||
    !Array.isArray(
      resolution.relations,
    ) ||
    !Array.isArray(
      resolution.candidates,
    )
  ) {
    throw new TypeError(
      "resolution relations and candidates are required",
    );
  }

  const candidates =
    candidateMap(
      resolution.candidates,
    );

  const nodes =
    new Map();

  const relations =
    new Map();

  const stats = {
    relationRows:
      resolution.relations.length,

    organizations: 0,
    relations: 0,

    deferredWithoutEdrpou: 0,
    skippedUnsupported: 0,
    skippedWeakCandidate: 0,

    manualReviewRelations: 0,
  };

  for (
    const row
    of resolution.relations
  ) {
    const sourceType =
      clean(
        row?.relation_type,
      );

    const graphType =
      EDR_GRAPH_RELATION_TYPES[
        sourceType
      ];

    if (!graphType) {
      stats
        .skippedUnsupported += 1;

      continue;
    }

    const candidate =
      candidates.get(
        String(row?.id ?? ""),
      );

    if (!candidate) {
      stats
        .skippedWeakCandidate += 1;

      continue;
    }

    const node =
      organizationNode(row);

    if (!node) {
      stats
        .deferredWithoutEdrpou += 1;

      continue;
    }

    nodes.set(
      node.nodeKey,
      node,
    );

    const key =
      relationKey(
        subjectId,
        node.id,
        graphType,
      );

    const observationId =
      clean(row?.id);

    const snapshotId =
      clean(
        row?.snapshot_id,
      );

    const confidence =
      Math.max(
        0,
        Math.min(
          84,
          Number(
            candidate.score,
          ) || 0,
        ),
      );

    const existing =
      relations.get(key);

    if (existing) {
      existing.confidence =
        Math.max(
          existing.confidence,
          confidence,
        );

      existing.metadata
        .observation_ids =
        mergeUnique(
          existing.metadata
            .observation_ids,
          [observationId],
        );

      existing.metadata
        .snapshot_ids =
        mergeUnique(
          existing.metadata
            .snapshot_ids,
          [snapshotId],
        );

      existing.metadata
        .evidence_count =
        existing.metadata
          .observation_ids
          .length;

      continue;
    }

    relations.set(
      key,
      {
        id:
          deterministicUuid(
            "edr-relation",
            key,
          ),

        relationKey:
          key,

        fromEntityId:
          subjectId,

        toEntityId:
          node.id,

        relationType:
          graphType,

        sourceDocumentId:
          null,

        validFrom:
          null,

        validTo:
          null,

        confidence,

        verificationStatus:
          "manual_review",

        metadata: {
          graph_version:
            VERSION,

          source:
            "edr",

          edr_relation_type:
            sourceType,

          organization_name:
            node.canonicalName,

          organization_edrpou:
            node.identifier
              .normalized,

          identity_status:
            resolution.status ??
            null,

          identity_decision:
            resolution.decision ??
            null,

          review_required:
            true,

          observation_ids:
            [observationId]
              .filter(Boolean),

          snapshot_ids:
            [snapshotId]
              .filter(Boolean),

          evidence_count:
            observationId
              ? 1
              : 0,

          relation_semantics:
            "Зв’язок знайдено у ЄДР за ПІБ. До підтвердження особи потребує ручної перевірки.",
        },
      },
    );
  }

  const nodeList =
    [...nodes.values()];

  const relationList =
    [...relations.values()];

  stats.organizations =
    nodeList.length;

  stats.relations =
    relationList.length;

  stats.manualReviewRelations =
    relationList.filter(
      (relation) =>
        relation.verificationStatus ===
        "manual_review",
    ).length;

  return {
    version:
      VERSION,

    nodes:
      nodeList,

    relations:
      relationList,

    stats,
  };
}
