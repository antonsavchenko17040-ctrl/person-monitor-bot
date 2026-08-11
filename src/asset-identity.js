import {
  normalizeText,
} from "./utils.js";

export const ASSET_IDENTITY_VERSION =
  "asset-identity-v1";

function clean(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function normalized(value) {
  const result =
    normalizeText(value);

  return result || null;
}

function normalizedNumber(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return String(
    Math.round(
      number * 1000,
    ) / 1000,
  );
}

export function
buildVehicleIdentityKey(
  fact,
) {
  if (
    fact?.fact_type !==
      "vehicle"
  ) {
    return null;
  }

  const value =
    fact?.value_json ?? {};

  const brand =
    normalized(
      value.brand,
    );

  const model =
    normalized(
      value.model,
    );

  const year =
    Number(
      value.production_year,
    );

  if (
    !brand ||
    !model ||
    !Number.isSafeInteger(year) ||
    year < 1800 ||
    year > 2200
  ) {
    return null;
  }

  return [
    "vehicle",
    brand,
    model,
    String(year),
  ].join("|");
}

export function
buildRealEstateIdentityKey(
  fact,
) {
  if (
    fact?.fact_type !==
      "real_estate"
  ) {
    return null;
  }

  const value =
    fact?.value_json ?? {};

  const type =
    normalized(
      value.object_type ??
      value.other_object_type ??
      fact?.value_text,
    );

  const area =
    normalizedNumber(
      value.total_area ??
      fact?.value_number,
    );

  const country =
    normalized(
      value.country,
    );

  const region =
    normalized(
      value.region,
    );

  const district =
    normalized(
      value.district,
    );

  const city =
    normalized(
      value.city,
    );

  const location =
    [
      country,
      region,
      district,
      city,
    ]
      .filter(Boolean)
      .join("|");

  /*
   * Type + area alone is not enough.
   * We require at least one location component.
   */
  if (
    !type ||
    !area ||
    !location
  ) {
    return null;
  }

  return [
    "real_estate",
    type,
    area,
    location,
  ].join("|");
}

export function
buildAssetIdentityKey(
  fact,
) {
  if (
    fact?.fact_type ===
      "vehicle"
  ) {
    return buildVehicleIdentityKey(
      fact,
    );
  }

  if (
    fact?.fact_type ===
      "real_estate"
  ) {
    return buildRealEstateIdentityKey(
      fact,
    );
  }

  return null;
}

function factView(fact) {
  return {
    id:
      fact?.id ?? null,

    fact_type:
      fact?.fact_type ?? null,

    value_text:
      fact?.value_text ?? null,

    value_number:
      fact?.value_number ?? null,

    value_json:
      fact?.value_json ?? null,

    source_document_id:
      fact?.source_document_id ??
      null,
  };
}

function groupAssets(facts) {
  const groups =
    new Map();

  const unkeyed = [];

  for (const fact of facts) {
    const key =
      buildAssetIdentityKey(
        fact,
      );

    if (!key) {
      if (
        fact?.fact_type ===
          "vehicle" ||
        fact?.fact_type ===
          "real_estate"
      ) {
        unkeyed.push(
          factView(fact),
        );
      }

      continue;
    }

    const group =
      groups.get(key) ?? [];

    group.push(fact);

    groups.set(
      key,
      group,
    );
  }

  return {
    groups,
    unkeyed,
  };
}

export function
compareAssetFacts(
  oldFacts = [],
  newFacts = [],
) {
  const oldState =
    groupAssets(
      oldFacts,
    );

  const newState =
    groupAssets(
      newFacts,
    );

  const keys =
    [
      ...new Set([
        ...oldState.groups.keys(),
        ...newState.groups.keys(),
      ]),
    ].sort();

  const result = {
    version:
      ASSET_IDENTITY_VERSION,

    unchanged: [],
    added: [],
    removed: [],
    ambiguous: [],

    unkeyed_old:
      oldState.unkeyed,

    unkeyed_new:
      newState.unkeyed,
  };

  for (const key of keys) {
    const oldGroup =
      oldState.groups.get(key) ??
      [];

    const newGroup =
      newState.groups.get(key) ??
      [];

    if (
      oldGroup.length > 1 ||
      newGroup.length > 1
    ) {
      result.ambiguous.push({
        key,

        reason:
          "duplicate_asset_identity",

        old_facts:
          oldGroup.map(
            factView,
          ),

        new_facts:
          newGroup.map(
            factView,
          ),
      });

      continue;
    }

    const oldFact =
      oldGroup[0] ?? null;

    const newFact =
      newGroup[0] ?? null;

    if (
      oldFact &&
      newFact
    ) {
      result.unchanged.push({
        key,

        old_fact:
          factView(
            oldFact,
          ),

        new_fact:
          factView(
            newFact,
          ),
      });

      continue;
    }

    if (newFact) {
      result.added.push({
        key,
        fact:
          factView(
            newFact,
          ),
      });

      continue;
    }

    if (oldFact) {
      result.removed.push({
        key,
        fact:
          factView(
            oldFact,
          ),
      });
    }
  }

  result.summary = {
    unchanged:
      result.unchanged.length,

    added:
      result.added.length,

    removed:
      result.removed.length,

    ambiguous:
      result.ambiguous.length,

    unkeyed_old:
      result.unkeyed_old.length,

    unkeyed_new:
      result.unkeyed_new.length,
  };

  return result;
}
