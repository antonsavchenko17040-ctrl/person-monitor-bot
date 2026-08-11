import {
  compareAssetFacts,
} from "./asset-identity.js";

export const ASSET_TRANSITION_VERSION =
  "asset-transition-v1";

function requiredYear(
  value,
  field,
) {
  const year =
    Number(value);

  if (
    !Number.isSafeInteger(year) ||
    year < 1900 ||
    year > 2200
  ) {
    throw new TypeError(
      field + " must be a valid year",
    );
  }

  return year;
}

function roleOf(fact) {
  return (
    fact?.value_json
      ?.person
      ?.role ??
    null
  );
}

function hasDeclarantRight(
  fact,
) {
  const rights =
    fact?.value_json
      ?.rights;

  if (!Array.isArray(rights)) {
    return false;
  }

  return rights.some(
    (right) =>
      right?.actor?.role ===
        "declarant",
  );
}

export function
isDeclarantAssetFact(
  fact,
) {
  if (
    fact?.fact_type !==
      "vehicle" &&
    fact?.fact_type !==
      "real_estate"
  ) {
    return false;
  }

  return (
    roleOf(fact) ===
      "declarant" ||
    hasDeclarantRight(fact)
  );
}

function assetTypeFromKey(
  key,
) {
  if (
    String(key).startsWith(
      "vehicle|",
    )
  ) {
    return "vehicle";
  }

  if (
    String(key).startsWith(
      "real_estate|",
    )
  ) {
    return "real_estate";
  }

  return null;
}

function eventFromChange(
  item,
  {
    eventType,
    fromYear,
    toYear,
  },
) {
  const fact =
    item?.fact ?? null;

  return {
    event_type:
      eventType,

    asset_type:
      assetTypeFromKey(
        item?.key,
      ) ??
      fact?.fact_type ??
      null,

    asset_key:
      item?.key ?? null,

    from_year:
      fromYear,

    to_year:
      toYear,

    year_gap:
      toYear - fromYear,

    observation:
      eventType ===
        "appeared"
        ? "present_in_new_snapshot_only"
        : "present_in_old_snapshot_only",

    /*
     * This event is an observation between
     * declarations, NOT proof of purchase/sale.
     */
    transaction_status:
      "not_inferred",

    fact,
  };
}

function countByAssetType(
  events,
  assetType,
) {
  return events.filter(
    (event) =>
      event.asset_type ===
        assetType,
  ).length;
}

export function
buildAssetTransitionEvents({
  fromYear,
  toYear,
  oldFacts = [],
  newFacts = [],
} = {}) {
  const normalizedFromYear =
    requiredYear(
      fromYear,
      "fromYear",
    );

  const normalizedToYear =
    requiredYear(
      toYear,
      "toYear",
    );

  if (
    normalizedToYear <=
      normalizedFromYear
  ) {
    throw new TypeError(
      "toYear must be greater than fromYear",
    );
  }

  const oldDeclarantAssets =
    oldFacts.filter(
      isDeclarantAssetFact,
    );

  const newDeclarantAssets =
    newFacts.filter(
      isDeclarantAssetFact,
    );

  const comparison =
    compareAssetFacts(
      oldDeclarantAssets,
      newDeclarantAssets,
    );

  const appeared =
    comparison.added.map(
      (item) =>
        eventFromChange(
          item,
          {
            eventType:
              "appeared",
            fromYear:
              normalizedFromYear,
            toYear:
              normalizedToYear,
          },
        ),
    );

  const disappeared =
    comparison.removed.map(
      (item) =>
        eventFromChange(
          item,
          {
            eventType:
              "disappeared",
            fromYear:
              normalizedFromYear,
            toYear:
              normalizedToYear,
          },
        ),
    );

  return {
    version:
      ASSET_TRANSITION_VERSION,

    from_year:
      normalizedFromYear,

    to_year:
      normalizedToYear,

    year_gap:
      normalizedToYear -
      normalizedFromYear,

    continuity:
      normalizedToYear -
        normalizedFromYear ===
      1
        ? "consecutive"
        : "gap",

    appeared,
    disappeared,

    unchanged:
      comparison.unchanged,

    ambiguous:
      comparison.ambiguous,

    unkeyed_old:
      comparison.unkeyed_old,

    unkeyed_new:
      comparison.unkeyed_new,

    summary: {
      appeared:
        appeared.length,

      disappeared:
        disappeared.length,

      unchanged:
        comparison
          .unchanged
          .length,

      ambiguous:
        comparison
          .ambiguous
          .length,

      unkeyed_old:
        comparison
          .unkeyed_old
          .length,

      unkeyed_new:
        comparison
          .unkeyed_new
          .length,

      vehicles_appeared:
        countByAssetType(
          appeared,
          "vehicle",
        ),

      vehicles_disappeared:
        countByAssetType(
          disappeared,
          "vehicle",
        ),

      real_estate_appeared:
        countByAssetType(
          appeared,
          "real_estate",
        ),

      real_estate_disappeared:
        countByAssetType(
          disappeared,
          "real_estate",
        ),
    },
  };
}
