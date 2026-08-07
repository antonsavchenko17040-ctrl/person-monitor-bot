import test from "node:test";
import assert from "node:assert/strict";

import {
  assetFromFact,
  assetMatchScore,
  matchAssetSets,
} from "../src/asset-tracking.js";

function realEstate(overrides = {}) {
  return assetFromFact({
    id:
      overrides.id ??
      crypto.randomUUID(),

    fact_type:
      "real_estate",

    value_text:
      "Квартира",

    value_number:
      overrides.area ?? 60,

    value_json: {
      object_type:
        "Квартира",

      country:
        "Україна",

      city:
        Object.hasOwn(
        overrides,
        "city",
      )
        ? overrides.city
        : "Київ",

      total_area:
        overrides.area ?? 60,

      acquisition_date:
        Object.hasOwn(
        overrides,
        "date",
      )
        ? overrides.date
        : "01.01.2020",

      person: {
        role:
          Object.hasOwn(
            overrides,
            "role",
          )
            ? overrides.role
            : "declarant",

        name:
          Object.hasOwn(
            overrides,
            "name",
          )
            ? overrides.name
            : "Іван Іванов",
      },

      rights: [],
    },
  });
}

function vehicle(overrides = {}) {
  return assetFromFact({
    id:
      overrides.id ??
      crypto.randomUUID(),

    fact_type:
      "vehicle",

    value_json: {
      object_type:
        "Автомобіль",

      brand:
        overrides.brand ??
        "Toyota",

      model:
        overrides.model ??
        "Camry",

      production_year:
        overrides.year ??
        2020,

      acquisition_date:
        overrides.date ??
        "01.01.2021",

      person: {
        role:
          "declarant",

        name:
          "Іван Іванов",
      },

      rights: [],
    },
  });
}

test(
  "matches same real estate across years",
  () => {
    const left =
      realEstate();

    const right =
      realEstate();

    assert.ok(
      assetMatchScore(
        left,
        right,
      ) >= 70,
    );
  },
);

test(
  "same type and area alone are not enough",
  () => {
    const left =
      realEstate({
        city: null,
        date: null,
        role: "unknown",
        name: null,
      });

    const right =
      realEstate({
        city: null,
        date: null,
        role: "unknown",
        name: null,
      });

    left.holders = [];
    right.holders = [];

    assert.ok(
      assetMatchScore(
        left,
        right,
      ) < 70,
    );
  },
);

test(
  "matches vehicle by brand model and year",
  () => {
    const left =
      vehicle();

    const right =
      vehicle();

    assert.ok(
      assetMatchScore(
        left,
        right,
      ) >= 70,
    );
  },
);

test(
  "different vehicle model does not match",
  () => {
    const left =
      vehicle({
        model: "Camry",
      });

    const right =
      vehicle({
        model: "Corolla",
      });

    assert.equal(
      assetMatchScore(
        left,
        right,
      ),
      0,
    );
  },
);

test(
  "ambiguous duplicate assets are not auto-confirmed",
  () => {
    const previous = [
      realEstate({
        id: "a",
      }),
      realEstate({
        id: "b",
      }),
    ];

    const current = [
      realEstate({
        id: "c",
      }),
      realEstate({
        id: "d",
      }),
    ];

    const result =
      matchAssetSets(
        previous,
        current,
      );

    assert.equal(
      result.retained.length,
      0,
    );

    assert.equal(
      result.uncertain.length,
      2,
    );

    assert.equal(
      result.appeared.length,
      0,
    );

    assert.equal(
      result.disappeared.length,
      0,
    );
  },
);
