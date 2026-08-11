import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSET_IDENTITY_VERSION,
  buildVehicleIdentityKey,
  buildRealEstateIdentityKey,
  compareAssetFacts,
} from "../src/asset-identity.js";

function vehicle({
  brand = "Toyota",
  model = "Camry",
  year = 2020,
} = {}) {
  return {
    fact_type:
      "vehicle",

    value_text:
      brand + " " + model,

    value_json: {
      brand,
      model,
      production_year:
        year,
    },
  };
}

function estate({
  type = "Квартира",
  area = 80,
  city = "Київ",
  region = null,
} = {}) {
  return {
    fact_type:
      "real_estate",

    value_text:
      type,

    value_number:
      area,

    value_json: {
      object_type:
        type,

      total_area:
        area,

      country:
        "Україна",

      region,
      district:
        null,

      city,
    },
  };
}

test(
  "exports asset identity version",
  () => {
    assert.equal(
      ASSET_IDENTITY_VERSION,
      "asset-identity-v1",
    );
  },
);

test(
  "same vehicle brand model and year has same identity",
  () => {
    assert.equal(
      buildVehicleIdentityKey(
        vehicle(),
      ),
      buildVehicleIdentityKey(
        vehicle({
          brand:
            "TOYOTA",
          model:
            "CAMRY",
        }),
      ),
    );
  },
);

test(
  "different vehicle model is not the same asset",
  () => {
    assert.notEqual(
      buildVehicleIdentityKey(
        vehicle({
          model:
            "Camry",
        }),
      ),
      buildVehicleIdentityKey(
        vehicle({
          model:
            "Corolla",
        }),
      ),
    );
  },
);

test(
  "same real estate type area and location has same identity",
  () => {
    assert.equal(
      buildRealEstateIdentityKey(
        estate(),
      ),
      buildRealEstateIdentityKey(
        estate({
          type:
            "КВАРТИРА",
          city:
            "КИЇВ",
        }),
      ),
    );
  },
);

test(
  "real estate type and area alone are not enough",
  () => {
    const fact =
      estate({
        city: null,
        region: null,
      });

    fact.value_json.country =
      null;

    assert.equal(
      buildRealEstateIdentityKey(
        fact,
      ),
      null,
    );
  },
);

test(
  "same real estate type and area in different cities is different",
  () => {
    assert.notEqual(
      buildRealEstateIdentityKey(
        estate({
          city:
            "Київ",
        }),
      ),
      buildRealEstateIdentityKey(
        estate({
          city:
            "Львів",
        }),
      ),
    );
  },
);

test(
  "duplicate asset identity is ambiguous",
  () => {
    const result =
      compareAssetFacts(
        [
          vehicle(),
          vehicle(),
        ],
        [
          vehicle(),
        ],
      );

    assert.equal(
      result.summary.ambiguous,
      1,
    );

    assert.equal(
      result.summary.unchanged,
      0,
    );
  },
);

test(
  "comparison separates unchanged added and removed assets",
  () => {
    const result =
      compareAssetFacts(
        [
          vehicle({
            model:
              "Camry",
          }),

          estate({
            city:
              "Київ",
          }),
        ],
        [
          vehicle({
            model:
              "Camry",
          }),

          estate({
            city:
              "Львів",
          }),
        ],
      );

    assert.equal(
      result.summary.unchanged,
      1,
    );

    assert.equal(
      result.summary.added,
      1,
    );

    assert.equal(
      result.summary.removed,
      1,
    );
  },
);
