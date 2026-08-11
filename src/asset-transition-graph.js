import {
  assetIdentity,
  deterministicUuid,
  persistRelationsGraph,
} from "./graph-builder.js";

import {
  stableFingerprint,
} from "./utils.js";

export const ASSET_TRANSITION_GRAPH_VERSION =
  "asset-transition-graph-v1";

export const ASSET_TRANSITION_RELATION_TYPES =
  Object.freeze({
    appeared:
      "asset_appeared_in_declaration",

    disappeared:
      "asset_disappeared_from_declaration",
  });

function requiredText(
  value,
  field,
) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    throw new TypeError(
      field + " is required",
    );
  }

  return text;
}

function validYear(value) {
  const year =
    Number(value);

  return (
    Number.isSafeInteger(year) &&
    year >= 1900 &&
    year <= 2200
  )
    ? year
    : null;
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ];
}

function assessmentKey(
  eventType,
  assetKey,
) {
  return [
    eventType ?? "",
    assetKey ?? "",
  ].join("|");
}

function buildAssessmentMap(
  financialAssessment,
) {
  const map =
    new Map();

  for (
    const item
    of [
      ...(
        financialAssessment
          ?.appeared ?? []
      ),
      ...(
        financialAssessment
          ?.disappeared ?? []
      ),
    ]
  ) {
    map.set(
      assessmentKey(
        item.event_type,
        item.asset_key,
      ),
      item,
    );
  }

  return map;
}

function relationTypeForEvent(
  event,
) {
  return (
    ASSET_TRANSITION_RELATION_TYPES[
      event?.event_type
    ] ?? null
  );
}

function relationSemantics(
  eventType,
) {
  if (
    eventType ===
      "appeared"
  ) {
    return (
      "Актив з’явився у новішій декларації " +
      "порівняно з попередньою. Це не є " +
      "автоматичним підтвердженням купівлі."
    );
  }

  return (
    "Актив відсутній у новішій декларації " +
    "після наявності у попередній. Це не є " +
    "автоматичним підтвердженням продажу."
  );
}

function transitionAssetNode(
  event,
) {
  const fact =
    event?.fact;

  if (!fact) {
    return null;
  }

  const identity =
    assetIdentity(fact);

  /*
   * Reuse the existing graph asset identity.
   * If the established graph builder cannot
   * identify the asset strongly enough, do not
   * create a second competing asset node.
   */
  if (!identity) {
    return null;
  }

  const nodeKey =
    "asset:" +
    identity.fingerprint;

  return {
    nodeKey,

    id:
      deterministicUuid(
        nodeKey,
      ),

    entityType:
      "asset",

    canonicalName:
      identity.canonicalName,

    identifier: {
      type:
        "asset_fingerprint",

      value:
        identity.fingerprint,

      normalized:
        identity.fingerprint,

      confidence:
        identity.confidence,
    },

    sourceDocumentId:
      fact.source_document_id ??
      null,

    metadata: {
      ...identity.metadata,

      source:
        "nazk-declaration",
    },
  };
}


function transitionConfidence(
  identityConfidence,
  yearGap,
) {
  const temporalConfidence =
    yearGap === 1
      ? 95
      : 70;

  return Math.min(
    identityConfidence,
    temporalConfidence,
  );
}

function signalCodes(
  assessment,
) {
  return unique(
    (
      assessment
        ?.findings ?? []
    )
      .map(
        (item) =>
          item?.code,
      ),
  );
}

function reviewRequired(
  assessment,
) {
  if (
    assessment
      ?.financial_status ===
      "ambiguous_disposal_income"
  ) {
    return true;
  }

  return (
    assessment
      ?.findings ?? []
  ).some(
    (item) =>
      item?.strength ===
        "review" ||
      item?.strength ===
        "ambiguous",
  );
}

function buildTransitionRelation({
  subjectEntityId,
  node,
  event,
  assessment,
  fromSourceDocumentId,
  toSourceDocumentId,
}) {
  const relationType =
    relationTypeForEvent(
      event,
    );

  if (!relationType) {
    return null;
  }

  const fromYear =
    validYear(
      event.from_year,
    );

  const toYear =
    validYear(
      event.to_year,
    );

  if (
    !fromYear ||
    !toYear ||
    toYear <= fromYear
  ) {
    return null;
  }

  const yearGap =
    toYear - fromYear;

  const relationKey =
    stableFingerprint(
      ASSET_TRANSITION_GRAPH_VERSION,
      relationType,
      subjectEntityId,
      node.id,
      fromYear,
      toYear,
    );

  const assessmentSignals =
    signalCodes(
      assessment,
    );

  const sourceDocumentIds =
    unique([
      fromSourceDocumentId,
      toSourceDocumentId,
      event?.fact
        ?.source_document_id,
    ]);

  return {
    id:
      deterministicUuid(
        "relation",
        relationKey,
      ),

    relationKey,

    fromEntityId:
      subjectEntityId,

    toEntityId:
      node.id,

    relationType,

    sourceDocumentId:
      event?.fact
        ?.source_document_id ??
      null,

    validFrom:
      toYear +
      "-01-01",

    validTo:
      toYear +
      "-12-31",

    confidence:
      transitionConfidence(
        node.identifier
          .confidence,
        yearGap,
      ),

    verificationStatus:
      "derived",

    metadata: {
      graph_version:
        ASSET_TRANSITION_GRAPH_VERSION,

      source:
        "nazk-declaration",

      transition_event:
        event.event_type,

      asset_kind:
        event.asset_type ??
        node.metadata
          ?.asset_kind ??
        null,

      asset_key:
        event.asset_key ??
        null,

      from_year:
        fromYear,

      to_year:
        toYear,

      year_gap:
        yearGap,

      temporal_precision:
        assessment
          ?.temporal_precision ??
        (
          yearGap === 1
            ? "consecutive"
            : "reduced_gap"
        ),

      financial_status:
        assessment
          ?.financial_status ??
        null,

      transaction_status:
        assessment
          ?.transaction_status ??
        "not_inferred",

      declared_income_uah:
        assessment
          ?.declared_income_uah ??
        null,

      declared_cost_uah:
        assessment
          ?.acquisition
          ?.declared_cost_uah ??
        null,

      cost_income_ratio:
        assessment
          ?.acquisition
          ?.cost_income_ratio ??
        null,

      disposal_candidate_count:
        assessment
          ?.disposal
          ?.candidate_count ??
        null,

      signal_codes:
        assessmentSignals,

      source_document_ids:
        sourceDocumentIds,

      review_required:
        reviewRequired(
          assessment,
        ),

      relation_semantics:
        relationSemantics(
          event.event_type,
        ),
    },
  };
}


export function
buildAssetTransitionGraphPlan({
  subjectEntityId,
  transition,
  financialAssessment = null,
  fromSourceDocumentId = null,
  toSourceDocumentId = null,
} = {}) {
  const subjectId =
    requiredText(
      subjectEntityId,
      "subjectEntityId",
    );

  const nodes =
    new Map();

  const relations =
    new Map();

  const assessments =
    buildAssessmentMap(
      financialAssessment,
    );

  const stats = {
    events: 0,

    nodes: 0,
    relations: 0,

    appearedRelations: 0,
    disappearedRelations: 0,

    weakAssetsSkipped: 0,
    invalidEventsSkipped: 0,
  };

  const events = [
    ...(
      transition
        ?.appeared ?? []
    ),
    ...(
      transition
        ?.disappeared ?? []
    ),
  ];

  stats.events =
    events.length;

  for (const event of events) {
    const relationType =
      relationTypeForEvent(
        event,
      );

    if (!relationType) {
      stats
        .invalidEventsSkipped +=
        1;

      continue;
    }

    const node =
      transitionAssetNode(
        event,
      );

    if (!node) {
      stats
        .weakAssetsSkipped +=
        1;

      continue;
    }

    nodes.set(
      node.nodeKey,
      node,
    );

    const assessment =
      assessments.get(
        assessmentKey(
          event.event_type,
          event.asset_key,
        ),
      ) ?? null;

    const relation =
      buildTransitionRelation({
        subjectEntityId:
          subjectId,

        node,
        event,
        assessment,

        fromSourceDocumentId,
        toSourceDocumentId,
      });

    if (!relation) {
      stats
        .invalidEventsSkipped +=
        1;

      continue;
    }

    relations.set(
      relation.relationKey,
      relation,
    );
  }

  const nodeList =
    [...nodes.values()];

  const relationList =
    [...relations.values()];

  stats.nodes =
    nodeList.length;

  stats.relations =
    relationList.length;

  stats.appearedRelations =
    relationList.filter(
      (item) =>
        item.relationType ===
          ASSET_TRANSITION_RELATION_TYPES
            .appeared,
    ).length;

  stats.disappearedRelations =
    relationList.filter(
      (item) =>
        item.relationType ===
          ASSET_TRANSITION_RELATION_TYPES
            .disappeared,
    ).length;

  return {
    version:
      ASSET_TRANSITION_GRAPH_VERSION,

    nodes:
      nodeList,

    relations:
      relationList,

    stats,
  };
}

export async function
persistAssetTransitionGraph(
  plan,
  options = {},
) {
  return persistRelationsGraph(
    plan,
    options,
  );
}
